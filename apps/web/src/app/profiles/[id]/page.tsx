import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-utils';
import { ProfileViewer } from '@/components/ProfileViewer';
import type { CommitData } from '@repo/profile-contract';

export const metadata: Metadata = {
  title: 'Profile — React Perf Profiler',
  description: 'A captured React performance profile.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await prisma.profile.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      data: true,
      metadata: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
    },
  });

  if (!profile) {
    notFound();
  }

  // Access control: public profiles are world-readable; private profiles
  // require the requester to be the owner.
  const user = await getAuthUser(new Request('http://localhost/api/profiles'));
  if (!profile.isPublic && (!user || user.id !== profile.userId)) {
    notFound();
  }

  // The `data` column is Json; cast through to the contract type. Shape
  // validation ran at ingestion time, so we trust the structure here.
  const commits = profile.data as unknown as CommitData[];

  return (
    <ProfileViewer
      profile={{
        id: profile.id,
        name: profile.name,
        commits,
        metadata: profile.metadata as Record<string, unknown>,
        isPublic: profile.isPublic,
        createdAt: profile.createdAt.toISOString(),
        isOwnedByCurrentUser: !!user && user.id === profile.userId,
      }}
    />
  );
}
