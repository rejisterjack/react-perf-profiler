#!/usr/bin/env node
/**
 * Simple WebRTC Signaling Relay Server
 * For development/testing - NOT for production use
 * 
 * Usage: node signaling-server.js [port]
 * Default port: 8080
 */

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.argv[2], 10) || 8080;

// In-memory session storage
const sessions = new Map(); // sessionCode -> Set of connections

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'ok', 
    message: 'WebRTC Signaling Relay Server',
    sessions: sessions.size,
  }));
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let peerId = null;
  let sessionCode = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'register':
          // Peer registration
          peerId = message.peerId;
          sessionCode = message.sessionCode;
          
          if (!sessions.has(sessionCode)) {
            sessions.set(sessionCode, new Map());
          }
          sessions.get(sessionCode).set(peerId, ws);
          
          console.log(`[${sessionCode}] Peer ${peerId} registered`);
          
          // Notify peer of successful registration
          ws.send(JSON.stringify({ type: 'registered', peerId }));
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
        case 'join-request':
          // Relay message to target or all peers in session
          relayMessage(sessionCode, message, peerId);
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
    }
  });

  ws.on('close', () => {
    if (sessionCode && sessions.has(sessionCode)) {
      sessions.get(sessionCode).delete(peerId);
      
      // Clean up empty sessions
      if (sessions.get(sessionCode).size === 0) {
        sessions.delete(sessionCode);
        console.log(`[${sessionCode}] Session closed (empty)`);
      } else {
        console.log(`[${sessionCode}] Peer ${peerId} disconnected`);
        
        // Notify other peers
        broadcast(sessionCode, {
          type: 'peer-disconnected',
          peerId,
        }, peerId);
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function relayMessage(sessionCode, message, senderId) {
  if (!sessionCode || !sessions.has(sessionCode)) return;

  const session = sessions.get(sessionCode);
  
  // If target is specified, send to specific peer
  if (message.targetId) {
    const target = session.get(message.targetId);
    if (target && target.readyState === 1) { // WebSocket.OPEN
      target.send(JSON.stringify({ ...message, senderId }));
    }
  } else {
    // Broadcast to all other peers in session
    broadcast(sessionCode, message, senderId);
  }
}

function broadcast(sessionCode, message, excludePeerId) {
  if (!sessions.has(sessionCode)) return;
  
  for (const [peerId, ws] of sessions.get(sessionCode)) {
    if (peerId !== excludePeerId && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }
}

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     WebRTC Signaling Relay Server                          ║
╠════════════════════════════════════════════════════════════╣
║  Port:     ${PORT.toString().padEnd(52)}║
║  URL:      ws://localhost:${PORT.toString().padEnd(45)}║
╠════════════════════════════════════════════════════════════╣
║  For development/testing only - NOT for production use     ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  wss.close();
  server.close();
  process.exit(0);
});
