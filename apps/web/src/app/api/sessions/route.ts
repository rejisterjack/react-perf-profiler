import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-utils';
import { z } from 'zod';
import { NextResponse } from 'next/server';

const createSessionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  signalingServer: z.string().url('Invalid signaling server URL'),
});

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

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
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
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
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: fieldErrors } },
        { status: 400 },
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

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
