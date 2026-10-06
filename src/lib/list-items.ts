/**
 * Normalises a list result from `purchases.list()` or `wallet.transactions()`.
 * The SDK's bundled types declare plain arrays while its docs describe a
 * `{ data, pagination }` envelope; accept either so pages work whichever the
 * API returns.
 */
export function listItems<T>(result: T[] | { data: T[] }): T[] {
  return Array.isArray(result) ? result : result.data
}
