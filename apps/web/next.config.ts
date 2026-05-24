import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/api/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Access-Control-Allow-Origin',
            value: [
              // Production extension ID(s) — update after CWS / AMO publishing
              ...(process.env.ALLOWED_EXTENSION_IDS
                ? process.env.ALLOWED_EXTENSION_IDS.split(',').map((id) => `chrome-extension://${id}`)
                : []),
              // Allow development extension ID (changes per load, so allow all in dev)
              ...(process.env.NODE_ENV !== 'production'
                ? ['chrome-extension://*', 'moz-extension://*']
                : []),
            ].join(', '),
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Authorization, Content-Type',
          },
        ],
      },
      {
        source: '/:path*\\.(js|css|woff2|woff|ttf|otf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*\\.(png|jpg|jpeg|gif|svg|webp|avif|ico)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
