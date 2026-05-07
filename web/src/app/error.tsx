'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-surface-300 mb-6">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue/80 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
