#!/usr/bin/env node
/**
 * React Perf Profiler — WebRTC Signaling Relay Server
 *
 * Production-ready relay with:
 *  - HMAC-SHA256 signed join tokens (prevents session hijacking)
 *  - Rate limiting per IP (max 10 msgs/s, 5 new connections/min)
 *  - Per-session peer limits (default: 8 peers)
 *  - Session TTL with automatic cleanup (default: 4 hours)
 *  - Structured JSON logging (production) / pretty logging (dev)
 *  - Graceful shutdown with drain period
 *  - /health and /metrics HTTP endpoints for Railway / Fly.io
 *
 * Environment variables:
 *   PORT                 Listening port (default: 8080)
 *   SESSION_SECRET       HMAC secret for token signing (required in prod)
 *   MAX_PEERS_PER_SESSION  Max peers per room (default: 8)
 *   SESSION_TTL_MS       Session TTL in ms (default: 14400000 = 4h)
 *   MSG_RATE_LIMIT       Max messages per second per connection (default: 10)
 *   NODE_ENV             Set to "production" for JSON logs
 *
 * Token flow:
 *   1. Host calls POST /create-session → gets { sessionCode, token }
 *   2. Host shares sessionCode with teammates (out of band)
 *   3. Guest calls POST /join-token { sessionCode } → gets { token }
 *   4. Both use token in the WebSocket "register" message
 *   5. Server verifies HMAC before admitting peer to session
 *
 * Usage:
 *   node scripts/signaling-server.js
 *   PORT=4000 SESSION_SECRET=my-secret node scripts/signaling-server.js
 */

'use strict';

const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

// ─── Configuration ────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '8080', 10);
const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  const generated = crypto.randomBytes(32).toString('hex');
  log('warn', 'SESSION_SECRET not set — generated a random secret for this process lifetime', {});
  log('warn', 'Set SESSION_SECRET env var for persistent token verification across restarts', {});
  return generated;
})();
const MAX_PEERS = parseInt(process.env.MAX_PEERS_PER_SESSION || '8', 10);
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS || String(4 * 60 * 60 * 1000), 10);
const MSG_RATE_LIMIT = parseInt(process.env.MSG_RATE_LIMIT || '10', 10); // msgs/second
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(level, message, data) {
  const entry = { ts: new Date().toISOString(), level, message, ...data };
  if (IS_PROD) {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    const colour = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' }[level] || '';
    const reset = '\x1b[0m';
    const extras = Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
    console.log(`${colour}[${level.toUpperCase()}]${reset} ${message}${extras}`);
  }
}

// ─── HMAC token helpers ───────────────────────────────────────────────────────

/**
 * Generate a signed join token for a session.
 * Payload: `${sessionCode}:${peerId}:${expiresAt}`
 */
function createToken(sessionCode, peerId) {
  const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes
  const payload = `${sessionCode}:${peerId}:${expiresAt}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  // base64url encode for easy transport
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

/**
 * Verify a join token. Returns { valid, sessionCode, peerId } or { valid: false }.
 */
function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const lastDot = decoded.lastIndexOf('.');
    if (lastDot === -1) return { valid: false, reason: 'malformed' };

    const payload = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { valid: false, reason: 'invalid_signature' };
    }

    const [sessionCode, peerId, expiresAt] = payload.split(':');
    if (!sessionCode || !peerId || !expiresAt) return { valid: false, reason: 'incomplete' };

    if (Date.now() > parseInt(expiresAt, 10)) {
      return { valid: false, reason: 'expired' };
    }

    return { valid: true, sessionCode, peerId };
  } catch {
    return { valid: false, reason: 'parse_error' };
  }
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

/** Simple token-bucket rate limiter per connection */
function createRateLimiter(maxPerSecond) {
  let tokens = maxPerSecond;
  let lastRefill = Date.now();

  return {
    allow() {
      const now = Date.now();
      const elapsed = (now - lastRefill) / 1000;
      tokens = Math.min(maxPerSecond, tokens + elapsed * maxPerSecond);
      lastRefill = now;
      if (tokens >= 1) {
        tokens -= 1;
        return true;
      }
      return false;
    },
  };
}

// ─── IP-level new-connection rate limiter ─────────────────────────────────────

const ipConnectCounts = new Map(); // ip -> { count, resetAt }
const MAX_CONNECTIONS_PER_MIN_PER_IP = 5;

function allowNewConnection(ip) {
  const now = Date.now();
  const entry = ipConnectCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    ipConnectCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= MAX_CONNECTIONS_PER_MIN_PER_IP) return false;
  entry.count++;
  return true;
}

// ─── Session store ────────────────────────────────────────────────────────────

/**
 * sessions: Map<sessionCode, {
 *   peers: Map<peerId, WebSocket>,
 *   createdAt: number,
 *   expiresAt: number,
 * }>
 */
const sessions = new Map();
const stats = { totalSessions: 0, totalMessages: 0, currentPeers: 0 };

function getOrCreateSession(sessionCode) {
  if (!sessions.has(sessionCode)) {
    sessions.set(sessionCode, {
      peers: new Map(),
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    stats.totalSessions++;
  }
  return sessions.get(sessionCode);
}

/** Remove expired sessions every 5 minutes */
setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [code, session] of sessions) {
    if (now > session.expiresAt && session.peers.size === 0) {
      sessions.delete(code);
      removed++;
    }
  }
  if (removed > 0) {
    log('info', `Cleaned up ${removed} expired sessions`, { activeSessions: sessions.size });
  }
}, 5 * 60 * 1000);

// ─── Message relay ────────────────────────────────────────────────────────────

const ALLOWED_RELAY_TYPES = new Set(['offer', 'answer', 'ice-candidate', 'join-request', 'profile-chunk', 'peer-ready']);

function relayMessage(sessionCode, message, senderId) {
  const session = sessions.get(sessionCode);
  if (!session) return;

  const envelope = { ...message, senderId };
  stats.totalMessages++;

  if (message.targetId) {
    const target = session.peers.get(message.targetId);
    if (target?.readyState === 1 /* OPEN */) {
      target.send(JSON.stringify(envelope));
    }
  } else {
    for (const [peerId, ws] of session.peers) {
      if (peerId !== senderId && ws.readyState === 1) {
        ws.send(JSON.stringify(envelope));
      }
    }
  }
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS headers (allow extension origin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ─ GET /health ─
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  // ─ GET /metrics ─
  if (req.method === 'GET' && url.pathname === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      activeSessions: sessions.size,
      currentPeers: stats.currentPeers,
      totalSessions: stats.totalSessions,
      totalMessages: stats.totalMessages,
      uptime: process.uptime(),
    }));
    return;
  }

  // ─ POST /create-session ─
  if (req.method === 'POST' && url.pathname === '/create-session') {
    readBody(req, (body) => {
      const { hostId } = body;
      if (!hostId || typeof hostId !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'hostId required' }));
        return;
      }
      const sessionCode = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F9"
      const token = createToken(sessionCode, hostId);
      log('info', 'Session created', { sessionCode, hostId });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessionCode, token, ttlMs: SESSION_TTL_MS }));
    });
    return;
  }

  // ─ POST /join-token ─
  if (req.method === 'POST' && url.pathname === '/join-token') {
    readBody(req, (body) => {
      const { sessionCode, peerId } = body;
      if (!sessionCode || !peerId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionCode and peerId required' }));
        return;
      }
      // Session must exist to get a join token
      if (!sessions.has(sessionCode)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'session not found' }));
        return;
      }
      const session = sessions.get(sessionCode);
      if (session.peers.size >= MAX_PEERS) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'session full', maxPeers: MAX_PEERS }));
        return;
      }
      const token = createToken(sessionCode, peerId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token, ttlMs: 30 * 60 * 1000 }));
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

function readBody(req, cb) {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    try { cb(JSON.parse(body || '{}')); }
    catch { cb({}); }
  });
}

// ─── WebSocket server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

  // IP-level rate limit for new connections
  if (!allowNewConnection(ip)) {
    log('warn', 'Connection rate limit exceeded', { ip });
    ws.close(1008, 'Too many connections');
    return;
  }

  let peerId = null;
  let sessionCode = null;
  const limiter = createRateLimiter(MSG_RATE_LIMIT);
  let registered = false;

  ws.on('message', (data) => {
    // Rate limit check
    if (!limiter.allow()) {
      ws.send(JSON.stringify({ type: 'error', code: 'rate_limited', message: 'Slow down' }));
      return;
    }

    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', code: 'parse_error', message: 'Invalid JSON' }));
      return;
    }

    if (typeof message.type !== 'string') {
      ws.send(JSON.stringify({ type: 'error', code: 'invalid_type' }));
      return;
    }

    // ─ register ─────────────────────────────────────────────────────────────
    if (message.type === 'register') {
      const { token } = message;
      if (!token) {
        ws.send(JSON.stringify({ type: 'error', code: 'auth_required', message: 'Token required' }));
        ws.close(1008, 'Unauthorized');
        return;
      }

      const result = verifyToken(token);
      if (!result.valid) {
        log('warn', 'Token rejected', { ip, reason: result.reason });
        ws.send(JSON.stringify({ type: 'error', code: 'auth_failed', reason: result.reason }));
        ws.close(1008, 'Invalid token');
        return;
      }

      peerId = result.peerId;
      sessionCode = result.sessionCode;

      const session = getOrCreateSession(sessionCode);

      // Enforce peer limit
      if (session.peers.size >= MAX_PEERS) {
        ws.send(JSON.stringify({ type: 'error', code: 'session_full', maxPeers: MAX_PEERS }));
        ws.close(1008, 'Session full');
        return;
      }

      // Reject duplicate peer IDs in the same session
      if (session.peers.has(peerId)) {
        ws.send(JSON.stringify({ type: 'error', code: 'duplicate_peer' }));
        ws.close(1008, 'Duplicate peer');
        return;
      }

      session.peers.set(peerId, ws);
      stats.currentPeers++;
      registered = true;

      log('info', 'Peer registered', { sessionCode, peerId, peers: session.peers.size });
      ws.send(JSON.stringify({
        type: 'registered',
        peerId,
        sessionCode,
        peers: session.peers.size,
        maxPeers: MAX_PEERS,
      }));

      // Notify existing peers of the new arrival
      for (const [existingId, existingWs] of session.peers) {
        if (existingId !== peerId && existingWs.readyState === 1) {
          existingWs.send(JSON.stringify({ type: 'peer-joined', peerId, peers: session.peers.size }));
        }
      }
      return;
    }

    // All other message types require registration
    if (!registered) {
      ws.send(JSON.stringify({ type: 'error', code: 'not_registered' }));
      return;
    }

    // Only relay allowed message types
    if (!ALLOWED_RELAY_TYPES.has(message.type)) {
      ws.send(JSON.stringify({ type: 'error', code: 'forbidden_type', msgType: message.type }));
      return;
    }

    relayMessage(sessionCode, message, peerId);
  });

  ws.on('close', () => {
    if (!registered || !sessionCode || !sessions.has(sessionCode)) return;

    const session = sessions.get(sessionCode);
    session.peers.delete(peerId);
    stats.currentPeers = Math.max(0, stats.currentPeers - 1);

    if (session.peers.size === 0) {
      sessions.delete(sessionCode);
      log('info', 'Session closed (empty)', { sessionCode });
    } else {
      log('info', 'Peer disconnected', { sessionCode, peerId, remaining: session.peers.size });
      // Notify remaining peers
      for (const [, ws] of session.peers) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'peer-disconnected', peerId, peers: session.peers.size }));
        }
      }
    }
  });

  ws.on('error', (err) => {
    log('error', 'WebSocket error', { peerId, sessionCode, error: err.message });
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  if (!IS_PROD) {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║   React Perf Profiler — WebRTC Signaling Relay            ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP:      http://localhost:${String(PORT).padEnd(32)}║
║  WS:        ws://localhost:${String(PORT).padEnd(33)}  ║
╠═══════════════════════════════════════════════════════════╣
║  POST /create-session   { hostId }  → { sessionCode, token }  ║
║  POST /join-token       { sessionCode, peerId } → { token }   ║
║  GET  /health                                               ║
║  GET  /metrics                                              ║
╠═══════════════════════════════════════════════════════════╣
║  Max peers/session: ${String(MAX_PEERS).padEnd(38)}║
║  Session TTL:       ${String(Math.round(SESSION_TTL_MS / 3600000) + 'h').padEnd(38)}║
║  Msg rate limit:    ${String(MSG_RATE_LIMIT + ' msgs/s').padEnd(38)}║
╚═══════════════════════════════════════════════════════════╝`);
  } else {
    log('info', 'Signaling relay started', { port: PORT, maxPeers: MAX_PEERS });
  }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

let shutdownInProgress = false;

function gracefulShutdown(signal) {
  if (shutdownInProgress) return;
  shutdownInProgress = true;

  log('info', `Received ${signal}, shutting down gracefully…`, {});

  // Notify all peers
  for (const [sessionCode, session] of sessions) {
    for (const [, ws] of session.peers) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'server-shutdown', message: 'Server is restarting' }));
        ws.close(1001, 'Server going away');
      }
    }
    sessions.delete(sessionCode);
  }

  wss.close(() => {
    server.close(() => {
      log('info', 'Server closed cleanly', {});
      process.exit(0);
    });
  });

  // Force exit after 5s drain period
  setTimeout(() => {
    log('warn', 'Forced exit after drain timeout', {});
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception', { error: err.message, stack: err.stack });
  gracefulShutdown('uncaughtException');
});
