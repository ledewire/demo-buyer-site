import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost:3001'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' }],
      },
    ]
  },
}

export default nextConfig
