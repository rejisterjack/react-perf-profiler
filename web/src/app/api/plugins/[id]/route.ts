import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-utils';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const plugin = await prisma.plugin.findUnique({
      where: { id },
    });

    if (!plugin) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Plugin not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ plugin });
  } catch (error) {
    console.error('Get plugin error:', error);
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

    const plugin = await prisma.plugin.findUnique({
      where: { id },
    });

    if (!plugin) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Plugin not found' } },
        { status: 404 },
      );
    }

    if (plugin.authorId !== user.id) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only the plugin author can delete this plugin' } },
        { status: 403 },
      );
    }

    await prisma.plugin.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete plugin error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
