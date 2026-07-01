import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-utils';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { logger, generateRequestId } from '@/lib/logger';

const publishPluginSchema = z.object({
  id: z.string().min(1, 'Plugin ID is required').max(100),
  name: z.string().min(1, 'Name is required').max(200),
  version: z.string().min(1, 'Version is required').max(50),
  description: z.string().max(2000).optional(),
  author: z.string().max(200).optional(),
  homepage: z.string().url().optional(),
  codeUrl: z.string().url('Code URL is required'),
  hooks: z.array(z.string()).min(1, 'At least one hook is required'),
  permissions: z.array(z.string()).optional().default([]),
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
    const plugins = await prisma.plugin.findMany({
      orderBy: { downloads: 'desc' },
    });

    return jsonWithRequestId({ plugins }, {}, requestId);
  } catch (error) {
    logger.error('Get plugins failed', { requestId, error: String(error) });
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
    const parsed = publishPluginSchema.safeParse(body);

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

    const { id, name, version, description, author, homepage, codeUrl, hooks, permissions } =
      parsed.data;

    const plugin = await prisma.plugin.create({
      data: {
        id,
        name,
        version,
        description,
        author,
        authorId: user.id,
        homepage,
        codeUrl,
        hooks,
        permissions,
      },
    });

    logger.info('Plugin published', {
      requestId,
      userId: user.id,
      pluginId: plugin.id,
    });

    return jsonWithRequestId({ plugin }, { status: 201 }, requestId);
  } catch (error: unknown) {
    logger.error('Publish plugin failed', {
      requestId,
      error: String(error),
    });

    // Handle unique constraint violation (duplicate plugin ID)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return jsonWithRequestId(
        {
          error: {
            code: 'DUPLICATE_ID',
            message: 'A plugin with this ID already exists',
            requestId,
          },
        },
        { status: 409 },
        requestId,
      );
    }

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
