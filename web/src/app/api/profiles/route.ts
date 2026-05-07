import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-utils';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

const MAX_PROFILE_SIZE = 10 * 1024 * 1024; // 10MB

const createProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  data: z.any().refine(
    (val) => {
      const size = JSON.stringify(val).length;
      return size <= MAX_PROFILE_SIZE;
    },
    { message: 'Profile data must be under 10MB' },
  ),
  metadata: z.record(z.unknown()).optional(),
  isPublic: z.boolean().optional().default(false),
});

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);

    const profiles = await prisma.profile.findMany({
      where: {
        OR: [
          { isPublic: true },
          ...(user ? [{ userId: user.id }] : []),
        ],
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Get profiles error:', error);
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
    const parsed = createProfileSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: fieldErrors } },
        { status: 400 },
      );
    }

    const { name, data, isPublic } = parsed.data;
    const metadata = parsed.data.metadata ?? {};

    const profile = await prisma.profile.create({
      data: {
        name,
        data: data as Prisma.InputJsonValue,
        metadata: metadata as Prisma.InputJsonValue,
        isPublic,
        userId: user.id,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error('Create profile error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
