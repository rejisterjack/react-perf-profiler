import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Stateless rate limiter for serverless environments.
 * Uses a signed cookie to track request counts per IP window.
 * No external state (Redis, KV) needed — at the cost of coarse granularity
 * across concurrent cold starts. Good enough for auth/write protection.
 */

const WINDOW_MS = 60_000;

function getLimits(pathname: string, method: string): { limit: number; windowMs: number } {
  if (pathname.startsWith('/api/auth')) {
    return { limit: 5, windowMs: WINDOW_MS };
  }
  if (
    (pathname.startsWith('/api/profiles') || pathname.startsWith('/api/sessions')) &&
    method !== 'GET'
  ) {
    return { limit: 30, windowMs: WINDOW_MS };
  }
  return { limit: 100, windowMs: WINDOW_MS };
}

function checkRateLimit(
  cookieValue: string | undefined,
  limit: number,
  windowMs: number,
): { allowed: boolean; newCookie: string } {
  const now = Date.now();
  let count = 0;
  let windowStart = now;

  if (cookieValue) {
    try {
      const parsed = JSON.parse(atob(cookieValue));
      if (parsed.s && now < parsed.s + windowMs) {
        count = parsed.c ?? 0;
        windowStart = parsed.s;
      }
    } catch {
      // Invalid cookie — start fresh
    }
  }

  count++;

  if (count > limit) {
    return { allowed: false, newCookie: cookieValue ?? '' };
  }

  const newCookie = btoa(JSON.stringify({ s: windowStart, c: count }));
  return { allowed: true, newCookie };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // CSRF protection: require Origin header on state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    if (!origin && !host) {
      return NextResponse.json(
        { error: { code: 'CSRF_DENIED', message: 'Missing origin header' } },
        { status: 403 },
      );
    }

    // Allow extension requests (they use Bearer auth, not cookies)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      // Extension requests with Bearer token are CSRF-safe
    } else {
      // For browser requests, validate Origin matches Host
      if (origin && host) {
        const originHost = origin.replace(/^https?:\/\//, '');
        if (originHost !== host) {
          return NextResponse.json(
            { error: { code: 'CSRF_DENIED', message: 'Origin does not match host' } },
            { status: 403 },
          );
        }
      }
    }
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  const { limit, windowMs } = getLimits(pathname, request.method);
  const cookieName = `rl_${ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const cookieValue = request.cookies.get(cookieName)?.value;
  const { allowed, newCookie } = checkRateLimit(cookieValue, limit, windowMs);

  if (!allowed) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const response = NextResponse.next();

  // Set/update rate limit cookie
  response.cookies.set(cookieName, newCookie, {
    maxAge: 120,
    httpOnly: true,
    sameSite: 'strict',
    path: '/api',
  });

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
