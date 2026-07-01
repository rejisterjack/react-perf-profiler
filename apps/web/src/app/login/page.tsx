import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';

export const metadata: Metadata = {
  title: 'Sign in — React Perf Profiler',
  description: 'Sign in to your React Perf Profiler account.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
