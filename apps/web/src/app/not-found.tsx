import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-brand-blue mb-4">404</h1>
        <h2 className="text-xl font-semibold text-white mb-2">Page not found</h2>
        <p className="text-surface-300 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="px-6 py-2 bg-brand-blue text-white rounded-lg hover:bg-brand-blue/80 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
