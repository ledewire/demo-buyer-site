/** Shown when a daily spend cap draft isn't a dollar amount of 0 or more. */
export const INVALID_CAP_MESSAGE = 'Enter a daily spend cap of $0 or more'

/**
 * A daily spend cap typed in dollars, as whole cents, or null when the draft
 * is missing, blank, not a number or negative.
 */
export function parseCapCents(draft: string | undefined): number | null {
  if (draft === undefined || draft.trim() === '') return null
  const dollars = Number(draft)
  if (!Number.isFinite(dollars) || dollars < 0) return null
  return Math.round(dollars * 100)
}
