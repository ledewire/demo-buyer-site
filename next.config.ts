import type { NextConfig } from 'next'
import { securityHeaders } from './src/lib/security-headers'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost:3001'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
