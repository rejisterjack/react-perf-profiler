import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-utils';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Session not found' } },
        { status: 404 },
      );
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: 'SESSION_EXPIRED', message: 'This session has expired' } },
        { status: 410 },
      );
    }

    // Check if user is already a participant
    if (session.participants.includes(user.id)) {
      return NextResponse.json(
        { error: { code: 'ALREADY_JOINED', message: 'You have already joined this session' } },
        { status: 409 },
      );
    }

    // Add user to participants
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        participants: {
          push: user.id,
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error('Join session error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
