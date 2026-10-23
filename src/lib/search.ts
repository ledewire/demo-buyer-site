import type { BuyerContentSearchRequest, ContentSearchResultWithPublication } from '@ledewire/node'
import { parseCapCents } from './spend-cap'
import { isWebUrl } from './web-url'
import type { SelectedWork } from './export-selection'

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

/**
 * The query string `parseSearchFilters` reads back: `q` and `max_price` as typed
 * (a blank max price left out), then the `cursor` of the page to load, if any.
 */
export function searchQueryString(q: string, maxPrice: string, cursor?: string): string {
  const qs = new URLSearchParams({ q })
  if (maxPrice) qs.set('max_price', maxPrice)
  if (cursor) qs.set('cursor', cursor)
  return qs.toString()
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

/**
 * Who a search result comes from: its Publication when it has one, else its store. A brokered
 * work's `store_name` is always `LedeWire`, which sells it, so one on no listed Publication is
 * named by its site instead.
 */
export function resultSource(result: ContentSearchResultWithPublication): string {
  if (result.publication) return result.publication.name
  if (result.content_type === 'brokered' && isWebUrl(result.url)) {
    return new URL(result.url).hostname.replace(/^www\./, '')
  }
  return result.store_name
}

/** Whether a search result can go in the bulk-export Selection: the work it adds, or why not. */
export type Selectability = { work: SelectedWork; reason: null } | { work: null; reason: string }

/**
 * Only a work with a web URL, from a Publication that licenses in bulk, can come back in an
 * export. The reason a result can't is the first of these that applies, worded for the buyer.
 */
export function selectability(result: ContentSearchResultWithPublication): Selectability {
  const { publication, url } = result
  const cannot = (reason: string): Selectability => ({ work: null, reason })
  if (!publication) {
    return cannot(
      result.content_type === 'brokered'
        ? "From a site that isn't a listed Publication"
        : 'Sold by a LedeWire store, not a Publication',
    )
  }
  if (!publication.bulk_licensable) return cannot(`${publication.name} doesn't license in bulk`)
  if (!isWebUrl(url)) return cannot('Has no web link')
  return {
    work: { url, publicationId: publication.id, publicationName: publication.name },
    reason: null,
  }
}

/** A search result as a work for the bulk-export Selection, or null when it can't be one. */
export function selectableWork(result: ContentSearchResultWithPublication): SelectedWork | null {
  return selectability(result).work
}
