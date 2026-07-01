'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { CommitData } from '@repo/profile-contract';

interface ProfileViewerProps {
  profile: {
    id: string;
    name: string;
    commits: CommitData[];
    metadata: Record<string, unknown>;
    isPublic: boolean;
    createdAt: string;
    isOwnedByCurrentUser: boolean;
  };
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function ProfileViewer({ profile }: ProfileViewerProps) {
  const stats = useMemo(() => {
    const commits = profile.commits;
    const totalDuration = commits.reduce((s, c) => s + c.duration, 0);
    const avgDuration = commits.length > 0 ? totalDuration / commits.length : 0;
    const maxDuration = commits.reduce((m, c) => Math.max(m, c.duration), 0);
    const uniqueComponents = new Set<string>();
    for (const c of commits) {
      const walk = c.rootFiber;
      if (walk) {
        let cur: typeof walk | null = walk;
        const stack: (typeof walk)[] = [];
        while (cur || stack.length) {
          while (cur) {
            uniqueComponents.add(cur.displayName);
            stack.push(cur);
            cur = cur.child;
          }
          const next = stack.pop();
          cur = next?.sibling ?? null;
        }
      }
    }
    return {
      commits: commits.length,
      totalDuration,
      avgDuration,
      maxDuration,
      components: uniqueComponents.size,
    };
  }, [profile.commits]);

  const score =
    typeof profile.metadata.performanceScore === 'number'
      ? (profile.metadata.performanceScore as number)
      : null;

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <Link
            href={profile.isOwnedByCurrentUser ? '/dashboard' : '/'}
            className="text-sm text-surface-400 hover:text-white"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {profile.isPublic && (
              <span className="text-xs px-2 py-0.5 rounded bg-brand-blue/15 text-brand-blue border border-brand-blue/30">
                public
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold mb-1">{profile.name}</h1>
        <p className="text-surface-400 text-sm mb-8">
          Captured {new Date(profile.createdAt).toLocaleString()}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
          {score !== null && (
            <Stat
              label="Score"
              value={score.toFixed(0)}
              tone={score >= 90 ? 'good' : score >= 50 ? 'warn' : 'bad'}
            />
          )}
          <Stat label="Commits" value={String(stats.commits)} />
          <Stat label="Components" value={String(stats.components)} />
          <Stat label="Total" value={formatMs(stats.totalDuration)} />
          <Stat label="Avg commit" value={formatMs(stats.avgDuration)} />
          <Stat label="Max commit" value={formatMs(stats.maxDuration)} />
        </div>

        <h2 className="text-lg font-semibold mb-3">Timeline</h2>
        {stats.maxDuration > 0 ? (
          <div className="space-y-1">
            {profile.commits.slice(0, 100).map((c) => {
              const widthPct = Math.max(2, (c.duration / stats.maxDuration) * 100);
              const severity = c.duration >= 16 ? 'bad' : c.duration >= 8 ? 'warn' : 'good';
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-xs text-surface-500 w-20 font-mono">
                    {formatMs(c.duration)}
                  </span>
                  <div
                    className={`h-5 rounded flex items-center px-2 text-[10px] ${
                      severity === 'bad'
                        ? 'bg-red-500/30 border border-red-500/40 text-red-200'
                        : severity === 'warn'
                          ? 'bg-brand-amber/20 border border-brand-amber/30 text-brand-amber'
                          : 'bg-brand-green/15 border border-brand-green/30 text-brand-green'
                    }`}
                    style={{ width: `${widthPct}%` }}
                  >
                    #{c.id.slice(0, 6)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-surface-500 text-sm">No commit data.</p>
        )}

        {profile.commits.length > 100 && (
          <p className="text-center text-xs text-surface-600 mt-4">
            Showing first 100 of {profile.commits.length} commits.
          </p>
        )}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-brand-green'
      : tone === 'warn'
        ? 'text-brand-amber'
        : tone === 'bad'
          ? 'text-red-400'
          : 'text-white';
  return (
    <div className="rounded-xl border border-white/5 bg-surface-800/40 p-4">
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      <div className="text-xs text-surface-500 mt-1">{label}</div>
    </div>
  );
}
