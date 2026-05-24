import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-utils';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getAuthUser(request);

    const profile = await prisma.profile.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Profile not found' } },
        { status: 404 },
      );
    }

    // Only allow access if the profile is public or the user is the owner
    if (!profile.isPublic && (!user || user.id !== profile.userId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You do not have access to this profile' } },
        { status: 403 },
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

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

    const profile = await prisma.profile.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!profile) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Profile not found' } },
        { status: 404 },
      );
    }

    if (profile.userId !== user.id) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only the owner can delete this profile' } },
        { status: 403 },
      );
    }

    await prisma.profile.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete profile error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
