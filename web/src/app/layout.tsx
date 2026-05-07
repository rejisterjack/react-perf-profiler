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
  ],
  authors: [{ name: 'React Perf Profiler Team' }],
  openGraph: {
    title: 'React Perf Profiler — Stop Guessing. Start Profiling.',
    description:
      'The open-source React performance profiler that finds wasted renders, scores memoization, and tells you exactly what to fix.',
    url: 'https://rejisterjack.github.io/react-perf-profiler/',
    siteName: 'React Perf Profiler',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'React Perf Profiler — Stop Guessing. Start Profiling.',
    description:
      'The open-source React performance profiler that finds wasted renders, scores memoization, and tells you exactly what to fix.',
  },
  robots: {
    index: true,
    follow: true,
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
        {/* Plausible Analytics */}
        <script
          defer
          data-domain={
            process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || 'rejisterjack.github.io'
          }
          src="https://plausible.io/js/script.js"
        />
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'React Perf Profiler',
              applicationCategory: 'DeveloperApplication',
              operatingSystem: 'Chrome, Firefox',
              description:
                'The open-source React performance profiler that finds wasted renders, scores memoization, and tells you exactly what to fix.',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              url: 'https://rejisterjack.github.io/react-perf-profiler/',
              author: {
                '@type': 'Organization',
                name: 'React Perf Profiler Team',
              },
              license: 'https://opensource.org/licenses/MIT',
            }),
          }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
