import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-utils';
import { z } from 'zod';
import { NextResponse } from 'next/server';

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

export async function GET() {
  try {
    const plugins = await prisma.plugin.findMany({
      orderBy: { downloads: 'desc' },
    });

    return NextResponse.json({ plugins });
  } catch (error) {
    console.error('Get plugins error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = publishPluginSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: fieldErrors } },
        { status: 400 },
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

    return NextResponse.json({ plugin }, { status: 201 });
  } catch (error: unknown) {
    console.error('Publish plugin error:', error);

    // Handle unique constraint violation (duplicate plugin ID)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: { code: 'DUPLICATE_ID', message: 'A plugin with this ID already exists' } },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
