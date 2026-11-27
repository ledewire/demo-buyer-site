import { afterEach, describe, it, expect, vi } from 'vitest'
import type { NextConfig } from 'next'
import nextConfig from '../../next.config'
import { contentSecurityPolicy } from './security-headers'

// Asserts through next.config so a header dropped from the config, not just
// from this module, fails the test. Lives here, not beside next.config.ts,
// because vitest only collects tests under src/ and bin/.
async function headersForEveryPath(config: NextConfig = nextConfig) {
  const routes = (await config.headers?.()) ?? []
  const everyPath = routes.find((route) => route.source === '/(.*)')
  return Object.fromEntries(
    (everyPath?.headers ?? []).map(({ key, value }) => [key, value]),
  ) as Record<string, string>
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
    ['Cross-Origin-Opener-Policy', 'same-origin-allow-popups'],
  ])('sets %s: %s on every path', async (key, value) => {
    expect(await headersForEveryPath()).toHaveProperty([key], value)
  })
})

function directives(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy.split(';').map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/)
      return [name, sources]
    }),
  )
}

describe('Content-Security-Policy (report-only)', () => {
  const policy = directives(contentSecurityPolicy({ dev: false }))
  const devPolicy = directives(contentSecurityPolicy({ dev: true }))

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('is sent report-only on every path, and never enforced', async () => {
    const headers = await headersForEveryPath()
    expect(headers).toHaveProperty(['Content-Security-Policy-Report-Only'])
    expect(headers).not.toHaveProperty(['Content-Security-Policy'])
  })

  it.each([
    ['default-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
  ])('sets %s to exactly %j', (directive, sources) => {
    expect(policy[directive]).toEqual(sources)
  })

  it.each([
    // The app's own pages, chunks and /api routes
    ['script-src', "'self'"],
    ['script-src', "'unsafe-inline'"], // Next's inline scripts
    ['connect-src', "'self'"],
    // Google sign-in (GoogleSignInButton)
    ['script-src', 'https://accounts.google.com/gsi/client'],
    ['style-src', 'https://accounts.google.com/gsi/style'],
    ['frame-src', 'https://accounts.google.com/gsi/'],
    ['connect-src', 'https://accounts.google.com/gsi/'],
    // Stripe Elements and 3DS (WalletFund)
    ['script-src', 'https://js.stripe.com'],
    ['script-src', 'https://*.js.stripe.com'],
    ['frame-src', 'https://js.stripe.com'],
    ['frame-src', 'https://*.js.stripe.com'],
    ['frame-src', 'https://hooks.stripe.com'],
    ['connect-src', 'https://api.stripe.com'],
    // Purchased article bodies may embed images from any host (ArticleView)
    ['img-src', 'https:'],
  ])('allows %s %s', (directive, source) => {
    expect(policy[directive]).toContain(source)
  })

  it("allows 'unsafe-eval' in script-src only in development, where React needs it", () => {
    expect(devPolicy['script-src']).toContain("'unsafe-eval'")
    expect(Object.values(policy).flat()).not.toContain("'unsafe-eval'")
  })

  it.each([
    ['development', contentSecurityPolicy({ dev: true })],
    ['production', contentSecurityPolicy({ dev: false })],
    ['test', contentSecurityPolicy({ dev: false })],
  ])('next.config sends the right policy when NODE_ENV=%s', async (env, expected) => {
    vi.stubEnv('NODE_ENV', env)
    vi.resetModules()
    const { default: config } = await import('../../next.config')
    expect((await headersForEveryPath(config))['Content-Security-Policy-Report-Only']).toBe(
      expected,
    )
  })
})
