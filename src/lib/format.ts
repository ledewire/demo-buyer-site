/** Formats an integer cent amount as US dollars, e.g. 1234 → "$12.34". */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Formats a micro-dollar amount (1/1,000,000 USD) as US dollars. Bulk quotes
 * price at micro precision; show four decimals so sub-cent totals stay visible.
 */
export function formatMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`
}

/** Formats an ISO timestamp as a locale date, or an em dash when absent. */
export function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString() : '—'
}
