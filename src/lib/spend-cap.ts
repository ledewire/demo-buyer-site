/** The largest daily spend cap the API accepts, in cents (a signed 32-bit integer). */
export const MAX_CAP_CENTS = 2_147_483_647

/** Shown when a daily spend cap draft isn't a dollar amount the API accepts. */
export const INVALID_CAP_MESSAGE = 'Enter a daily spend cap from $0 to $21,474,836.47'

/** A Route Handler's refusal of a request body whose cap fails isCapCents. */
export const INVALID_CAP_CENTS_MESSAGE = `daily_spend_limit_cents must be an integer from 0 to ${MAX_CAP_CENTS}`

/**
 * Whether `cap` is a daily spend cap the API accepts: whole cents from zero to
 * MAX_CAP_CENTS. A cap can be changed but never removed, so null is not one.
 */
export function isCapCents(cap: unknown): cap is number {
  return Number.isInteger(cap) && (cap as number) >= 0 && (cap as number) <= MAX_CAP_CENTS
}

/**
 * A daily spend cap typed in dollars, as whole cents, or null when the draft
 * is missing, blank, not a number, negative or above MAX_CAP_CENTS.
 */
export function parseCapCents(draft: string | undefined): number | null {
  if (draft === undefined || draft.trim() === '') return null
  const dollars = Number(draft)
  if (!Number.isFinite(dollars) || dollars < 0) return null
  const cents = Math.round(dollars * 100)
  return isCapCents(cents) ? cents : null
}
