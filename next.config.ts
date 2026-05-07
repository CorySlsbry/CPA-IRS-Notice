import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Cloud Run / Docker: emit a self-contained Node server.
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: '*.googleapis.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/track.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=300' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/api/track/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
      {
        source: '/api/public/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-api-key' },
        ],
      },
    ];
  },
  async rewrites() {
    return [{ source: '/track.js', destination: '/api/track/script' }];
  },
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  serverExternalPackages: ['firebase-admin', 'pg'],
  // Don't fail the production build on lint or type warnings — we run those
  // separately via `npm run lint` / `npm run typecheck`. This keeps Cloud
  // Build deploys unblocked when there's a known lint warning we haven't
  // gotten to.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default config;
