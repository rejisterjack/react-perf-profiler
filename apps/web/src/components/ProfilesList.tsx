'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface ProfileSummary {
  id: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function performanceBadge(metadata: Record<string, unknown>): {
  label: string;
  className: string;
} | null {
  const score = metadata.performanceScore;
  if (typeof score !== 'number') return null;
  if (score >= 90)
    return {
      label: `${score.toFixed(0)} · good`,
      className: 'bg-brand-green/15 text-brand-green border-brand-green/30',
    };
  if (score >= 50)
    return {
      label: `${score.toFixed(0)} · needs work`,
      className: 'bg-brand-amber/15 text-brand-amber border-brand-amber/30',
    };
  return {
    label: `${score.toFixed(0)} · poor`,
    className: 'bg-red-500/15 text-red-300 border-red-500/30',
  };
}

export function ProfilesList({
  initialProfiles,
  initialNextCursor,
}: {
  initialProfiles: ProfileSummary[];
  initialNextCursor: string | null;
}) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingMore, startLoadMore] = useTransition();
  const [deletingId, startDelete] = useTransition();

  function loadMore() {
    if (!nextCursor) return;
    startLoadMore(async () => {
      const res = await fetch(`/api/profiles?cursor=${nextCursor}&limit=20`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        profiles: ProfileSummary[];
        nextCursor: string | null;
      };
      setProfiles((prev) => [...prev, ...data.profiles]);
      setNextCursor(data.nextCursor);
    });
  }

  function onDelete(id: string) {
    if (!confirm('Delete this profile? This cannot be undone.')) return;
    startDelete(async () => {
      const res = await fetch(`/api/profiles/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setProfiles((prev) => prev.filter((p) => p.id !== id));
        router.refresh();
      }
    });
  }

  if (profiles.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface-800/40 p-12 text-center">
        <h2 className="text-lg font-semibold text-white mb-1">No profiles yet</h2>
        <p className="text-surface-400 text-sm mb-4">
          Once you capture a profile in the extension, sign in with the same account and use
          &quot;Sync to cloud&quot; to see it here.
        </p>
        <a
          href="https://github.com/rejisterjack/react-perf-profiler/blob/main/README.md#quick-start"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-brand-blue hover:text-brand-cyan text-sm"
        >
          Read the install guide ↗
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {profiles.map((p) => {
        const badge = performanceBadge(p.metadata);
        return (
          <div
            key={p.id}
            className="group rounded-xl border border-white/5 bg-surface-800/40 hover:bg-surface-800/60 hover:border-white/10 transition-all p-4 flex items-center justify-between"
          >
            <a href={`/profiles/${p.id}`} className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-semibold text-white truncate">{p.name}</h3>
                {badge && (
                  <span className={`text-xs px-2 py-0.5 rounded border ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
                {p.isPublic && (
                  <span className="text-xs px-2 py-0.5 rounded bg-brand-blue/15 text-brand-blue border border-brand-blue/30">
                    public
                  </span>
                )}
              </div>
              <p className="text-xs text-surface-500">
                Captured {formatDate(p.createdAt)} · {String(p.metadata.totalCommits ?? '?')}{' '}
                commits
              </p>
            </a>
            <button
              type="button"
              onClick={() => onDelete(p.id)}
              disabled={deletingId}
              className="ml-3 text-xs text-surface-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              aria-label={`Delete ${p.name}`}
            >
              Delete
            </button>
          </div>
        );
      })}

      {nextCursor && (
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="px-5 h-10 rounded-lg bg-surface-800 hover:bg-surface-700 border border-white/10 text-sm text-surface-200 transition-all disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
