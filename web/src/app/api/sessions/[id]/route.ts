import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-utils';
import { NextResponse } from 'next/server';

export async function DELETE(
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
      select: { ownerId: true },
    });

    if (!session) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Session not found' } },
        { status: 404 },
      );
    }

    if (session.ownerId !== user.id) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only the owner can delete this session' } },
        { status: 403 },
      );
    }

    await prisma.session.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
