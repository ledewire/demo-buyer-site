'use client'

import { useEffect, useState } from 'react'
import type { ContentSearchResponse, ContentSearchResultWithPublication } from '@ledewire/node'
import { formatCents } from '@/lib/format'
import { DEFAULT_RETRY_AFTER_S } from '@/lib/search'

interface Props {
  /** The query and max price (dollars) from the URL, as typed. */
  q: string
  maxPrice: string
  /** The first page, searched on the server; null when nothing was searched. */
  initialPage: ContentSearchResponse | null
  /** Seconds to wait when the server's first-page search was rate limited. */
  initialRetryAfter?: number
  /** Why the server couldn't search, shown under the form. */
  initialError?: string
}

/** The whole seconds a 429's Retry-After asks for. */
function retryAfterSeconds(res: Response): number {
  const s = Number(res.headers.get('Retry-After'))
  return Number.isFinite(s) && s > 0 ? Math.ceil(s) : DEFAULT_RETRY_AFTER_S
}

export default function ContentSearch({
  q,
  maxPrice,
  initialPage,
  initialRetryAfter,
  initialError,
}: Props) {
  const [results, setResults] = useState<ContentSearchResultWithPublication[] | null>(
    initialPage?.data ?? null,
  )
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage?.next_cursor ?? null)
  // Whether the latest page missed a source. Its next_cursor re-asks for the
  // missed part, so Load more is the retry.
  const [partial, setPartial] = useState(initialPage?.partial_results ?? false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)
  // Seconds left before searching again is allowed, after a 429.
  const [retryIn, setRetryIn] = useState(initialRetryAfter ?? 0)
  const rateLimited = retryIn > 0

  useEffect(() => {
    if (!rateLimited) return
    const t = setInterval(() => setRetryIn((n) => Math.max(0, n - 1)), 1000)
    return () => clearInterval(t)
  }, [rateLimited])

  async function loadMore(cursor: string) {
    setError(null)
    setLoading(true)
    try {
      // The filters the loaded results came from, as the URL holds them; the
      // cursor is only valid with exactly these.
      const qs = new URLSearchParams({ q })
      if (maxPrice) qs.set('max_price', maxPrice)
      qs.set('cursor', cursor)
      const res = await fetch(`/api/search?${qs.toString()}`)
      if (res.status === 429) {
        setRetryIn(retryAfterSeconds(res))
        return
      }
      if (res.status === 422) {
        // A stale or mismatched cursor: drop it and what it paged through, so
        // the next search starts again from page one.
        setResults(null)
        setNextCursor(null)
        setPartial(false)
        setError('This search expired — search again')
        return
      }
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Search failed')
        return
      }
      const next = data as ContentSearchResponse
      setResults((prev) => [...(prev ?? []), ...next.data])
      setNextCursor(next.next_cursor)
      setPartial(next.partial_results)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const noneLoaded = results !== null && results.length === 0

  return (
    <div className="space-y-4">
      <form method="get" action="/search" className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-96">
          <label htmlFor="search-q" className="block text-xs font-medium text-gray-600">
            Search
          </label>
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={q}
            autoFocus
            placeholder="Title, topic or author"
            className="mt-1 w-full rounded-md border-gray-300 text-sm shadow-xs focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="search-max-price" className="block text-xs font-medium text-gray-600">
            Max price ($)
          </label>
          <input
            id="search-max-price"
            name="max_price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={maxPrice}
            className="mt-1 w-28 rounded-md border-gray-300 text-sm shadow-xs"
          />
        </div>
        <button
          type="submit"
          disabled={rateLimited}
          className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {rateLimited && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
        >
          Too many searches — try again in {retryIn} s
        </p>
      )}

      {partial && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2">
          Some sources couldn&apos;t be searched, so these results may be incomplete
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {results.map((r) => (
            <ResultRow key={r.id} result={r} />
          ))}
        </ul>
      )}

      {noneLoaded && !nextCursor && !partial && (
        <p className="text-sm text-gray-500 py-12 text-center">Nothing matched</p>
      )}
      {noneLoaded && nextCursor && (
        <p className="text-sm text-gray-500 py-8 text-center">
          No matches yet — Load more to keep searching
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
        >
          {error}
        </p>
      )}

      {nextCursor && (
        <button
          type="button"
          onClick={() => loadMore(nextCursor)}
          disabled={loading || rateLimited}
          className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}

function ResultRow({ result }: { result: ContentSearchResultWithPublication }) {
  return (
    <li className="px-4 py-3 space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{result.title || 'Untitled'}</p>
        <span className="text-sm font-medium text-gray-900">{formatCents(result.price_cents)}</span>
      </div>
      <p className="text-xs text-gray-500">
        <span>{result.store_name}</span>
        {result.authors && result.authors.length > 0 && <span> · {result.authors.join(', ')}</span>}
      </p>
      {result.teaser && <p className="text-sm text-gray-700">{result.teaser}</p>}
    </li>
  )
}
