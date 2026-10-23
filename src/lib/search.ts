import type { BuyerContentSearchRequest } from '@ledewire/node'
import { parseCapCents } from './spend-cap'

/** The filters a search was run with; Load more must send the same ones with its cursor. */
export type SearchFilters = Pick<BuyerContentSearchRequest, 'max_price_cents'> & { query: string }

export const INVALID_MAX_PRICE_MESSAGE = 'Enter a max price of $0 or more'

/**
 * The `q` and `max_price` (dollars) of a search URL as the filters `content.search`
 * takes: null when there is no query to search for, `{ error }` when the max price
 * isn't a dollar amount. A blank max price means no limit.
 */
export function parseSearchFilters(
  q: string | null | undefined,
  maxPrice: string | null | undefined,
): SearchFilters | { error: string } | null {
  const query = q?.trim()
  if (!query) return null
  if (!maxPrice?.trim()) return { query }
  const cents = parseCapCents(maxPrice)
  if (cents === null) return { error: INVALID_MAX_PRICE_MESSAGE }
  return { query, max_price_cents: cents }
}
