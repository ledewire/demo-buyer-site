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

/** Searches with a query are limited per minute; wait that long when a 429 doesn't say. */
const DEFAULT_RETRY_AFTER_S = 60

/**
 * The whole seconds to wait after a 429, from the SDK's `retryAfter` or a
 * `Retry-After` header: a minute when it's missing, zero or not a number.
 */
export function retryAfterSeconds(value: number | string | null | undefined): number {
  const s = Number(value)
  return Number.isFinite(s) && s > 0 ? Math.ceil(s) : DEFAULT_RETRY_AFTER_S
}

/** A search result's title for display; a result's title can be empty. */
export function resultTitle(result: { title: string }): string {
  return result.title || 'Untitled'
}
