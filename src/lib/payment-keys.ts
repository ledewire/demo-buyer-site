import type { PaymentKeyCreateRequest } from '@ledewire/node'

/** A Buyer or Machine user holds at most this many active Payment keys. */
export const PAYMENT_KEY_LIMIT = 10

const FIELDS = ['name', 'public_key', 'proof'] as const

/**
 * Reads a Payment key registration from a request body: exactly `{ name, public_key, proof }`,
 * each trimmed, and nothing else. Any other field, such as a private key pasted by mistake, is
 * dropped here so it never reaches the API. Returns an error message when a field is missing or
 * blank.
 */
export function parsePaymentKeyRegistration(
  body: unknown,
): { ok: true; registration: PaymentKeyCreateRequest } | { ok: false; error: string } {
  const source = (body ?? {}) as Record<string, unknown>
  const registration = { name: '', public_key: '', proof: '' }
  for (const field of FIELDS) {
    // eslint-disable-next-line security/detect-object-injection -- field is one of FIELDS
    const value = source[field]
    if (typeof value !== 'string' || !value.trim()) {
      return { ok: false, error: `${field} is required` }
    }
    // eslint-disable-next-line security/detect-object-injection -- field is one of FIELDS
    registration[field] = value.trim()
  }
  return { ok: true, registration }
}
