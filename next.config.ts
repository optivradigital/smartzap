import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Next.js 16 uses Turbopack by default
  // External packages that should not be bundled (server-only Node.js modules)
  serverExternalPackages: ['ioredis'],

  reactStrictMode: true,

  // Standalone output for Docker
  output: 'standalone',

  // Include SQL migration files in the serverless bundle
  outputFileTracingIncludes: {
    '/api/setup/migrate': ['./lib/migrations/**/*'],
  },

  // Environment variables exposed to client
  env: {
    NEXT_PUBLIC_APP_NAME: 'SmartZap',
  },

  // React Compiler for automatic memoization (moved from experimental in Next.js 16)
  reactCompiler: true,

  // Turbopack config
  turbopack: {
    // Set the workspace root to this directory
    root: __dirname,
  },


  // Resolve Node.js built-in modules for browser bundles (used by ioredis server-side only)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        dns: false,
        fs: false,
        tls: false,
        crypto: false,
      }
    }
    return config
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },

  // Headers for security and CORS
  async headers() {
    const allowedOrigin = process.env.FRONTEND_URL || 'https://smartzap.vercel.app'
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: allowedOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-API-Key' },
        ],
      },
    ]
  },
}

export default nextConfig
