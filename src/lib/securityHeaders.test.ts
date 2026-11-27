import { describe, it, expect } from 'vitest'
import nextConfig from '../../next.config'

// Asserts through next.config so a header dropped from the config, not just
// from this module, fails the test.
async function headersForEveryPath(): Promise<Record<string, string>> {
  const routes = (await nextConfig.headers?.()) ?? []
  const everyPath = routes.find((route) => route.source === '/(.*)')
  return Object.fromEntries((everyPath?.headers ?? []).map(({ key, value }) => [key, value]))
}

describe('security headers', () => {
  it('does not send x-powered-by', () => {
    expect(nextConfig.poweredByHeader).toBe(false)
  })

  it.each([
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
    // Google sign-in's popup returns the credential via postMessage.
    ['Cross-Origin-Opener-Policy', 'same-origin-allow-popups'],
  ])('sets %s: %s on every path', async (key, value) => {
    expect(await headersForEveryPath()).toHaveProperty([key], value)
  })
})
