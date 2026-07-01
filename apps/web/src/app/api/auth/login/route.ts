import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { logger, generateRequestId } from '@/lib/logger';

const JWT_SECRET = process.env.NEXTAUTH_SECRET!;

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
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

function signTokens(user: { id: string; email: string; name: string }) {
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, name: user.name, kind: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' },
  );
  const refreshToken = jwt.sign(
    { sub: user.id, kind: 'refresh', jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: '30d' },
  );
  return { accessToken, refreshToken };
}

/**
 * Email/password login for extension and CLI clients. Issues a short-lived
 * access token (15 min) and a long-lived refresh token (30 d) that the client
 * stores and uses with /api/auth/refresh.
 *
 * Returns the same error code ('INVALID_CREDENTIALS') for both "user not
 * found" and "wrong password" to avoid user-enumeration via timing.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return jsonWithRequestId(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: fieldErrors,
            requestId,
          },
        },
        { status: 400 },
        requestId,
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always run a bcrypt compare against a fixed hash so the timing is
    // identical whether or not the user exists. Prevents enumeration.
    const DUMMY_HASH = '$2a$12$oooooooooooooooooooooooooooooooooooooooooooooooooooooo';
    const passwordMatch = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

    if (!user || !passwordMatch) {
      return jsonWithRequestId(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            requestId,
          },
        },
        { status: 401 },
        requestId,
      );
    }

    const { accessToken, refreshToken } = signTokens({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    logger.info('User logged in', { requestId, userId: user.id });

    return jsonWithRequestId(
      {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
        tokenType: 'Bearer',
        user: { id: user.id, email: user.email, name: user.name },
      },
      { status: 200 },
      requestId,
    );
  } catch (error) {
    logger.error('Login failed', { requestId, error: String(error) });
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
