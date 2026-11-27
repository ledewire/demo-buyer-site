import { describe, it, expect } from 'vitest'
import nextConfig from '../../next.config'
import { contentSecurityPolicy } from './security-headers'

// Asserts through next.config so a header dropped from the config, not just
// from this module, fails the test. Lives here, not beside next.config.ts,
// because vitest only collects tests under src/ and bin/.
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
  it('is sent report-only on every path, and never enforced', async () => {
    const headers = await headersForEveryPath()
    expect(headers).toHaveProperty(['Content-Security-Policy-Report-Only'])
    expect(headers).not.toHaveProperty(['Content-Security-Policy'])
  })

  it('defaults to self', () => {
    expect(directives(contentSecurityPolicy({ dev: false }))['default-src']).toEqual(["'self'"])
  })

  it.each([
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
    expect(directives(contentSecurityPolicy({ dev: false }))[directive]).toContain(source)
  })

  it("allows 'unsafe-eval' only in development, where React needs it", () => {
    expect(directives(contentSecurityPolicy({ dev: true }))['script-src']).toContain(
      "'unsafe-eval'",
    )
    expect(contentSecurityPolicy({ dev: false })).not.toContain("'unsafe-eval'")
  })

  it('sends the non-development policy outside development', async () => {
    // Vitest runs with NODE_ENV=test; production builds take the same branch.
    expect((await headersForEveryPath())['Content-Security-Policy-Report-Only']).toBe(
      contentSecurityPolicy({ dev: false }),
    )
  })
})
