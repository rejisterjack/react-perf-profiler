/**
 * ErrorBoundary — Canonical re-export
 *
 * The full implementation lives in ./ErrorBoundary/ErrorBoundary.tsx.
 * This file exists so that imports like `from './components/ErrorBoundary'`
 * resolve without needing `/index` or a directory import.
 */

export { ErrorBoundary, default } from './ErrorBoundary/ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary/ErrorBoundary';
