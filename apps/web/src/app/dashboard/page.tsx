import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth-utils';
import { ProfilesList } from '@/components/ProfilesList';

export const metadata: Metadata = {
  title: 'Dashboard — React Perf Profiler',
  description: 'Your captured React performance profiles.',
  robots: { index: false, follow: false },
};

// Always render dynamically — the page depends on the authenticated user.
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; limit?: string }>;
}) {
  const user = await getAuthUser(
    // The dashboard uses the NextAuth cookie session (no Request.headers
    // available here), so we pass a synthetic request. getAuthUser falls back
    // to auth() which reads cookies from the Next.js request scope.
    new Request('http://localhost/api/profiles'),
  );

  if (!user) {
    redirect('/login');
  }

  const sp = await searchParams;
  const limit = Math.min(Math.max(Number(sp.limit ?? '20'), 1), 100);
  const cursor = sp.cursor ?? undefined;

  const profiles = await prisma.profile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
      metadata: true,
    },
  });

  const hasMore = profiles.length > limit;
  const items = hasMore ? profiles.slice(0, limit) : profiles;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <a href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-react flex items-center justify-center">
              <span className="text-surface-900 font-bold">⚡</span>
            </div>
            <span className="font-bold text-lg">React Perf Profiler</span>
          </a>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-surface-400">{user.email}</span>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="text-surface-300 hover:text-white transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Your profiles</h1>
            <p className="text-surface-400 text-sm">
              Profiles captured by the extension and synced to your account.
            </p>
          </div>
          <a
            href="https://github.com/rejisterjack/react-perf-profiler#quick-start"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-blue hover:text-brand-cyan"
          >
            Install the extension ↗
          </a>
        </div>

        <ProfilesList
          initialProfiles={items.map((p) => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
            metadata: p.metadata as Record<string, unknown>,
          }))}
          initialNextCursor={nextCursor ?? null}
        />
      </main>
    </div>
  );
}
