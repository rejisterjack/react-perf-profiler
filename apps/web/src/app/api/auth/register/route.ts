import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { logger, generateRequestId } from '@/lib/logger';

const JWT_SECRET = process.env.NEXTAUTH_SECRET!;

// Short-lived access tokens limit the blast radius of a leaked token.
// A separate, longer-lived refresh token (also a JWT, but with a different
// audience) lets extension clients stay authenticated without re-entering
// credentials every 15 minutes.
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&\-_])[A-Za-z\d@$!%*?&\-_]+$/,
      'Password must contain uppercase, lowercase, number, and special character',
    ),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
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
    { expiresIn: ACCESS_TOKEN_TTL },
  );
  const refreshToken = jwt.sign(
    { sub: user.id, kind: 'refresh', jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL },
  );
  return { accessToken, refreshToken };
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

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

    const { email, password, name } = parsed.data;

    // Check for duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return jsonWithRequestId(
        {
          error: {
            code: 'DUPLICATE_EMAIL',
            message: 'An account with this email already exists',
            requestId,
          },
        },
        { status: 409 },
        requestId,
      );
    }

    // Hash password (cost 12 — ~250ms per hash, acceptable for signup)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Issue access + refresh tokens. The extension stores the refresh token
    // and uses it to mint new access tokens via /api/auth/refresh.
    const { accessToken, refreshToken } = signTokens(user);

    logger.info('User registered', {
      requestId,
      userId: user.id,
      email: user.email,
    });

    return jsonWithRequestId(
      {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
        tokenType: 'Bearer',
        user,
      },
      { status: 201 },
      requestId,
    );
  } catch (error) {
    // Previously this catch was silent — server operators had zero signal on
    // 500s during signup. Now it logs and surfaces a requestId.
    logger.error('Register failed', { requestId, error: String(error) });
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
