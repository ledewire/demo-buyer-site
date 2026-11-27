// Response headers sent on every path, from next.config.ts. Most answer the
// Q4 2026 Qualys scan of the buyer portal (#110).
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
]
