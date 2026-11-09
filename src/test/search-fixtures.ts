import { vi } from 'vitest'
import type {
  ContentAccessInfo,
  ContentSearchResultWithPublication,
  ContentWithAccessResponse,
} from '@ledewire/node'

/** A search result, "Ocean heat" for $1.25 from a LedeWire-native store unless overridden. */
export function makeResult(
  overrides: Partial<ContentSearchResultWithPublication> = {},
): ContentSearchResultWithPublication {
  return {
    id: 'c-1',
    title: 'Ocean heat',
    teaser: 'Oceans are warming faster than expected.',
    price_cents: 125,
    content_type: 'markdown',
    store_id: 's-1',
    store_name: 'Daily Planet',
    tags: [],
    url: null,
    authors: null,
    abstract: null,
    doi: null,
    publication_date: null,
    last_modified_date: null,
    citation_count: null,
    publication: null,
    filing: null,
    ...overrides,
  }
}

/** Answers the next `fetch` (which must already be a `vi.fn()`) with a JSON body. */
export function mockFetchOnce(status: number, body: object, headers: Record<string, string> = {}) {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as Response)
}

/** A `GET /api/content/[id]/access` body for "Ocean heat" at $1.25, with `access_info` overridden. */
export function makePreview(
  access: Partial<ContentAccessInfo> = {},
): Pick<ContentWithAccessResponse, 'id' | 'price_cents' | 'access_info'> {
  return {
    id: 'c-1',
    price_cents: 125,
    access_info: {
      user_id: 'u-1',
      has_purchased: false,
      has_sufficient_funds: true,
      wallet_balance_cents: 1000,
      next_required_action: 'purchase',
      remaining_cents: null,
      company_name: null,
      ...access,
    },
  }
}

/** The preview for a buyer paying from their own $10.00 wallet, who can afford the work. */
export const PREVIEW = makePreview()
