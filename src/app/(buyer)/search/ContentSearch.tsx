'use client'

import { useEffect, useState } from 'react'
import type { ContentSearchResponse, ContentSearchResultWithPublication } from '@ledewire/node'
import { formatCents } from '@/lib/format'
import { type SelectedWork, useExportSelection } from '@/lib/export-selection'
import {
  resultSource,
  resultTitle,
  retryAfterSeconds,
  searchQueryString,
  selectableWork,
} from '@/lib/search'
import BuyConfirmation from './BuyConfirmation'
import ArticleView, { type BoughtWork } from './ArticleView'
import ErrorAlert from './ErrorAlert'

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
  // The result whose Buy confirmation is open.
  const [confirming, setConfirming] = useState<ContentSearchResultWithPublication | null>(null)
  // The work just bought, held only in memory: refreshing loses it.
  const [bought, setBought] = useState<BoughtWork | null>(null)
  const selection = useExportSelection()
  // The works ticked for the Selection but not yet added to it, by URL.
  const [ticked, setTicked] = useState<Map<string, SelectedWork>>(new Map())

  function toggle(work: SelectedWork) {
    setTicked((prev) => {
      const next = new Map(prev)
      if (!next.delete(work.url)) next.set(work.url, work)
      return next
    })
  }

  function addTicked() {
    selection.addMany([...ticked.values()])
    setTicked(new Map())
  }

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
      const res = await fetch(`/api/search?${searchQueryString(q, maxPrice, cursor)}`)
      if (res.status === 429) {
        setRetryIn(retryAfterSeconds(res.headers.get('Retry-After')))
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
        // Worded as the server-rendered first page words it (page.tsx).
        setError(data.error ? `API error: ${data.error}` : 'Search failed')
        return
      }
      const next = data as ContentSearchResponse
      setResults((prev) => {
        // A page that re-asks for a missed source may repeat a row already shown.
        const seen = new Set((prev ?? []).map((r) => r.id))
        return [...(prev ?? []), ...next.data.filter((r) => !seen.has(r.id))]
      })
      setNextCursor(next.next_cursor)
      setPartial(next.partial_results)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const noneLoaded = results !== null && results.length === 0

  // The results, cursor and filters stay in state underneath, so Back needs no new search.
  if (bought) return <ArticleView work={bought} onBack={() => setBought(null)} />

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

      {rateLimited && <ErrorAlert>Too many searches — try again in {retryIn} s</ErrorAlert>}

      {partial && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2">
          Some sources couldn&apos;t be searched, so these results may be incomplete
        </p>
      )}

      {results?.some((r) => selectableWork(r)) && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={addTicked}
            disabled={ticked.size === 0}
            className="px-3 py-1 rounded-md border border-indigo-600 text-sm font-medium text-indigo-700 bg-white hover:bg-indigo-50 disabled:opacity-50"
          >
            Add {ticked.size} to selection
          </button>
        </div>
      )}

      {results && results.length > 0 && (
        <ul className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {results.map((r) => {
            const work = selectableWork(r)
            return (
              <ResultRow
                key={r.id}
                result={r}
                onBuy={() => setConfirming(r)}
                checkbox={
                  work && {
                    inSelection: selection.has(work.url),
                    ticked: ticked.has(work.url),
                    onToggle: () => toggle(work),
                  }
                }
              />
            )
          })}
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

      {error && <ErrorAlert>{error}</ErrorAlert>}

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

      {confirming && (
        <BuyConfirmation
          result={confirming}
          onCancel={() => setConfirming(null)}
          onBought={(delivery) => {
            setBought({ result: confirming, delivery })
            setConfirming(null)
          }}
        />
      )}
    </div>
  )
}

/** A result's checkbox for the Selection: whether it is already in it, or ticked to be added. */
interface SelectionCheckbox {
  inSelection: boolean
  ticked: boolean
  onToggle: () => void
}

function ResultRow({
  result,
  onBuy,
  checkbox,
}: {
  result: ContentSearchResultWithPublication
  onBuy: () => void
  /** Null for a result that can't go in the Selection, which gets no checkbox. */
  checkbox: SelectionCheckbox | null
}) {
  const title = resultTitle(result)
  return (
    <li className="px-4 py-3 space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          {checkbox && (
            <input
              type="checkbox"
              aria-label={checkbox.inSelection ? `${title} is in the selection` : `Select ${title}`}
              checked={checkbox.inSelection || checkbox.ticked}
              disabled={checkbox.inSelection}
              onChange={checkbox.onToggle}
              className="rounded-sm border-gray-300 text-indigo-600 disabled:opacity-40"
            />
          )}
          <p className="text-sm font-medium text-gray-900">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900">
            {formatCents(result.price_cents)}
          </span>
          <button
            type="button"
            onClick={onBuy}
            aria-label={`Buy ${title}`}
            className="px-3 py-1 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Buy
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        <span>{resultSource(result)}</span>
        {result.authors && result.authors.length > 0 && <span> · {result.authors.join(', ')}</span>}
      </p>
      {result.teaser && <p className="text-sm text-gray-700">{result.teaser}</p>}
    </li>
  )
}
