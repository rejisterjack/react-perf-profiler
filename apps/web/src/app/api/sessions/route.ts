import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-utils';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { logger, generateRequestId } from '@/lib/logger';

const createSessionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  signalingServer: z.string().url('Invalid signaling server URL'),
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

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return jsonWithRequestId(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
        requestId,
      );
    }

    // Cursor pagination — see /api/profiles for the rationale.
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '50'), 1), 100);
    const cursor = url.searchParams.get('cursor') ?? undefined;

    const sessions = await prisma.session.findMany({
      where: {
        OR: [{ ownerId: user.id }, { participants: { has: user.id } }],
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = sessions.length > limit;
    const items = hasMore ? sessions.slice(0, limit) : sessions;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return jsonWithRequestId({ sessions: items, nextCursor, hasMore }, {}, requestId);
  } catch (error) {
    logger.error('Get sessions failed', { requestId, error: String(error) });
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

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return jsonWithRequestId(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
        requestId,
      );
    }

    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);

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

    const { name, signalingServer } = parsed.data;

    // Session expires 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        name,
        signalingServer,
        ownerId: user.id,
        participants: [user.id],
        expiresAt,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    logger.info('Session created', {
      requestId,
      userId: user.id,
      sessionId: session.id,
    });

    return jsonWithRequestId({ session }, { status: 201 }, requestId);
  } catch (error) {
    logger.error('Create session failed', {
      requestId,
      error: String(error),
    });
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
