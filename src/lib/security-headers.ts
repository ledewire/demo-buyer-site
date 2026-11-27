// Response headers next.config.ts sends on every path.

const GOOGLE_GSI = 'https://accounts.google.com/gsi/'
const STRIPE_JS = ['https://js.stripe.com', 'https://*.js.stripe.com']

/**
 * The portal's CSP. Third parties: Google sign-in (GoogleSignInButton) and
 * Stripe Elements and 3DS (WalletFund). Ledewire API calls go through our own
 * /api routes, so they're covered by 'self'.
 *
 * 'unsafe-inline' covers Next's inline scripts until the policy is nonce-based.
 * React needs 'unsafe-eval' in development only.
 */
export function contentSecurityPolicy({ dev }: { dev: boolean }): string {
  return [
    "default-src 'self'",
    [
      "script-src 'self' 'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      `${GOOGLE_GSI}client`,
      ...STRIPE_JS,
    ].join(' '),
    `style-src 'self' 'unsafe-inline' ${GOOGLE_GSI}style`,
    ['frame-src', GOOGLE_GSI, ...STRIPE_JS, 'https://hooks.stripe.com'].join(' '),
    `connect-src 'self' ${GOOGLE_GSI} https://api.stripe.com`,
    // Purchased article bodies (ArticleView) embed images from any host.
    "img-src 'self' data: https:",
    "font-src 'self' data:",
  ].join('; ')
}

export const securityHeaders = [
  // VS Code's port-forwarding proxy injects COOP: same-origin, which blocks the
  // Google GSI popup from returning the credential via window.postMessage.
  // same-origin-allow-popups keeps isolation while allowing popups we opened.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Nothing embeds the portal; Stripe 3DS and Google sign-in frame their own pages.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Report-only: violations go to the browser console and nothing is blocked.
  // Enforce, with frame-ancestors 'none', once real use shows a clean console.
  {
    key: 'Content-Security-Policy-Report-Only',
    value: contentSecurityPolicy({ dev: process.env.NODE_ENV === 'development' }),
  },
]
