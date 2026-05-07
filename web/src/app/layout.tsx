import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://reactperfprofiler.com',
  ),
  title: 'React Perf Profiler — Stop Guessing. Start Profiling.',
  description:
    'The open-source React performance profiler that finds wasted renders, scores memoization effectiveness, and tells you exactly what to fix. Works with React 16.5+, Next.js, Vite, and Remix.',
  keywords: [
    'React',
    'performance',
    'profiler',
    'DevTools',
    'wasted renders',
    'memoization',
    'React Server Components',
    'Next.js',
    'open source',
    'react render optimization',
    'react memoization checker',
    'react devtools alternative',
    'react performance monitoring',
    'next.js performance profiler',
    'wasted render detection',
    'react component profiling',
    'render cycle analyzer',
    'react profiler extension',
    'react performance tool',
  ],
  authors: [{ name: 'React Perf Profiler Team' }],
  creator: 'React Perf Profiler Team',
  publisher: 'React Perf Profiler Team',
  category: 'Developer Tools',
  openGraph: {
    title: 'React Perf Profiler — Stop Guessing. Start Profiling.',
    description:
      'The open-source React performance profiler that finds wasted renders, scores memoization, and tells you exactly what to fix.',
    url: '/',
    siteName: 'React Perf Profiler',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'React Perf Profiler — Stop Guessing. Start Profiling.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'React Perf Profiler — Stop Guessing. Start Profiling.',
    description:
      'The open-source React performance profiler that finds wasted renders, scores memoization, and tells you exactly what to fix.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script
          defer
          data-domain={
            process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || 'localhost'
          }
          src="https://plausible.io/js/script.js"
        />
      </head>
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
