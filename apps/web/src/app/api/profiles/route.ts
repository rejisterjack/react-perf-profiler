import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-utils';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { profileUploadRequestSchema } from '@repo/profile-contract/schema';
import type { ProfileUploadRequest } from '@repo/profile-contract';
import { logger, generateRequestId } from '@/lib/logger';

// Hard ceiling on the serialized payload. The middleware layer enforces this
// against Content-Length before the route handler runs; this constant is used
// for the secondary in-handler guard on the parsed body.
const MAX_PROFILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Attach a request id to a JSON response. If the inbound request carried an
 * `X-Request-Id` header (e.g. from an upstream proxy or the extension
 * itself) we forward it; otherwise we generate one. Either way it ends up
 * in the response header and the error envelope so a user reporting an
 * error can quote it verbatim.
 */
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

    // Cursor pagination — protects the listing endpoint from OOM as the
    // profiles table grows. The client passes `cursor` (a profile id) and
    // `limit` (1–100, default 50). Results are ordered by createdAt DESC so
    // the most recent profiles come first; pass the last item's id back as
    // the next cursor.
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '50'), 1), 100);
    const cursor = url.searchParams.get('cursor') ?? undefined;

    const profiles = await prisma.profile.findMany({
      where: {
        OR: [{ isPublic: true }, ...(user ? [{ userId: user.id }] : [])],
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // fetch one extra to detect a next page
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 } // skip the cursor row itself
        : {}),
    });

    const hasMore = profiles.length > limit;
    const items = hasMore ? profiles.slice(0, limit) : profiles;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return jsonWithRequestId({ profiles: items, nextCursor, hasMore }, {}, requestId);
  } catch (error) {
    logger.error('Get profiles failed', { requestId, error: String(error) });
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

    // Cheap size guard: reject before parsing if the client declared a size
    // over the limit. Prevents CPU-bound JSON.stringify-based checks from
    // becoming a DoS vector. (The middleware layer also enforces this.)
    const declaredSize = Number(request.headers.get('content-length') ?? 0);
    if (declaredSize > MAX_PROFILE_SIZE_BYTES) {
      return jsonWithRequestId(
        {
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Profile payload exceeds the ${MAX_PROFILE_SIZE_BYTES} byte limit`,
          },
        },
        { status: 413 },
        requestId,
      );
    }

    const body: unknown = await request.json();

    // Secondary size guard on the parsed body (catches clients that lied in
    // the header). Cheaper than re-stringifying the entire object.
    if (JSON.stringify(body).length > MAX_PROFILE_SIZE_BYTES) {
      return jsonWithRequestId(
        {
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Profile payload exceeds the ${MAX_PROFILE_SIZE_BYTES} byte limit`,
          },
        },
        { status: 413 },
        requestId,
      );
    }

    // Shape validation via the canonical contract schema. Replaces the prior
    // `data: z.any()` hole — the API now rejects malformed profiles at the
    // boundary instead of accepting arbitrary JSON.
    const parsed = profileUploadRequestSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return jsonWithRequestId(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid profile payload',
            details: fieldErrors,
            requestId,
          },
        },
        { status: 400 },
        requestId,
      );
    }

    const { name, data, isPublic, metadata } = parsed.data as ProfileUploadRequest;

    const profile = await prisma.profile.create({
      data: {
        name,
        data: data as unknown as Prisma.InputJsonValue,
        metadata: (metadata ?? {}) as unknown as Prisma.InputJsonValue,
        isPublic,
        userId: user.id,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    logger.info('Profile created', {
      requestId,
      userId: user.id,
      profileId: profile.id,
    });

    return jsonWithRequestId({ profile }, { status: 201 }, requestId);
  } catch (error) {
    logger.error('Create profile failed', {
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
