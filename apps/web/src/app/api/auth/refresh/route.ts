import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { logger, generateRequestId } from '@/lib/logger';

const JWT_SECRET = process.env.NEXTAUTH_SECRET!;

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

function requestIdFrom(request: Request): string {
  return request.headers.get('x-request-id') ?? generateRequestId();
}

function jsonWithRequestId(
  body: unknown,
  init: { status?: number } & ResponseInit,
  requestId: string,
) {
  const res = NextResponse.json(body, init);
  res.headers.set('X-Request-Id', requestId);
  return res;
}

/**
 * Exchange a valid refresh token for a new access token (and a rotated
 * refresh token). Extension/CLI clients call this when their access token
 * expires (15 min) so they can keep posting profiles without re-entering
 * credentials for up to 30 days.
 *
 * NOTE: this stateless rotation does NOT revoke the old refresh token — it
 * is still valid until it expires. A production hardening pass should add a
 * server-side revocation list (e.g. a Redis set of revoked jtis) so that
 * logout actually invalidates outstanding tokens. Tracked in ROADMAP under
 * Phase 5 "auth hardening".
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const body = await request.json();
    const parsed = refreshSchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithRequestId(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parsed.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400 },
        requestId,
      );
    }

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(parsed.data.refreshToken, JWT_SECRET) as jwt.JwtPayload;
    } catch {
      return jsonWithRequestId(
        {
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh token is invalid or expired',
            requestId,
          },
        },
        { status: 401 },
        requestId,
      );
    }

    if (payload.kind !== 'refresh') {
      return jsonWithRequestId(
        {
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Token is not a refresh token',
            requestId,
          },
        },
        { status: 401 },
        requestId,
      );
    }

    const userId = payload.sub;
    if (!userId) {
      return jsonWithRequestId(
        {
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh token missing subject',
            requestId,
          },
        },
        { status: 401 },
        requestId,
      );
    }

    const accessToken = jwt.sign({ sub: userId, kind: 'access' }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(
      { sub: userId, kind: 'refresh', jti: crypto.randomUUID() },
      JWT_SECRET,
      { expiresIn: '30d' },
    );

    return jsonWithRequestId(
      {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
        tokenType: 'Bearer',
      },
      { status: 200 },
      requestId,
    );
  } catch (error) {
    logger.error('Refresh failed', { requestId, error: String(error) });
    return jsonWithRequestId(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          requestId,
        },
      },
      { status: 500 },
      requestId,
    );
  }
}
