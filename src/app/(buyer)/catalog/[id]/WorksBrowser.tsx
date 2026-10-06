'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { PublicationWork, PublicationWorkListResponse } from '@ledewire/node'
import { useExportSelection } from '@/lib/export-selection'
import { formatDate } from '@/lib/format'

interface Props {
  publicationId: string
  publicationName: string
  bulkLicensable: boolean
}

export default function WorksBrowser({ publicationId, publicationName, bulkLicensable }: Props) {
  const selection = useExportSelection()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [works, setWorks] = useState<PublicationWork[] | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<PublicationWorkListResponse['date_filter'] | null>(
    null,
  )
  // The range the loaded results came from — "Load more" must reuse it even if
  // the inputs have since been edited.
  const [loadedRange, setLoadedRange] = useState({ from: '', to: '' })
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(range: { from: string; to: string }, cursor?: string) {
    setError(null)
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (range.from) qs.set('from', range.from)
      if (range.to) qs.set('to', range.to)
      if (cursor) qs.set('cursor', cursor)
      const res = await fetch(
        `/api/publications/${encodeURIComponent(publicationId)}/works?${qs.toString()}`,
      )
      const data = await res.json()
      if (!res.ok) {
        setError(
          res.status === 429
            ? 'Too many requests — wait a moment and try again.'
            : (data.error ?? 'Failed to load articles'),
        )
        return
      }
      const page = data as PublicationWorkListResponse
      setWorks((prev) => (cursor && prev ? [...prev, ...page.works] : page.works))
      setNextCursor(page.next_cursor)
      setDateFilter(page.date_filter)
      setLoadedRange(range)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    load({ from, to })
  }

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (works ?? []).filter((w) => !q || w.url.toLowerCase().includes(q))
  }, [works, filter])

  const toSelected = (w: PublicationWork) => ({ url: w.url, publicationId, publicationName })
  const selectedHere = selection.items.filter((w) => w.publicationId === publicationId).length

  return (
    <div className="space-y-4">
      {!bulkLicensable && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2">
          This publication isn&apos;t available for bulk licensing. You can browse its articles but
          not add them to an export.
        </p>
      )}

      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="works-from" className="block text-xs font-medium text-gray-600">
            From
          </label>
          <input
            id="works-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded-md border-gray-300 text-sm shadow-xs"
          />
        </div>
        <div>
          <label htmlFor="works-to" className="block text-xs font-medium text-gray-600">
            To
          </label>
          <input
            id="works-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded-md border-gray-300 text-sm shadow-xs"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading && !works ? 'Searching…' : 'Find articles'}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
        >
          {error}
        </p>
      )}

      {dateFilter === 'unsupported' && (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-sm px-3 py-2">
          This publication has no modification dates; the date range was ignored.
        </p>
      )}

      {works && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="search"
              aria-label="Filter by URL"
              placeholder="Filter by URL"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full sm:w-72 rounded-md border-gray-300 text-sm shadow-xs"
            />
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">{selectedHere} selected from this publication</span>
              {bulkLicensable && (
                <button
                  type="button"
                  onClick={() => selection.addMany(shown.map(toSelected))}
                  disabled={shown.length === 0}
                  className="font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                  Select all shown
                </button>
              )}
              {selection.items.length > 0 && (
                <Link href="/exports/new" className="font-medium text-indigo-600 underline">
                  Review export ({selection.items.length})
                </Link>
              )}
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No articles found.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Article
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last modified
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shown.map((w) => {
                    const checked = selection.has(w.url)
                    return (
                      <tr key={w.url}>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${w.url}`}
                            checked={checked}
                            disabled={!bulkLicensable}
                            onChange={() =>
                              checked ? selection.remove(w.url) : selection.add(toSelected(w))
                            }
                            className="rounded-sm border-gray-300 text-indigo-600 disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-800 break-all">
                          <a
                            href={w.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-indigo-700 hover:underline"
                          >
                            {w.url}
                          </a>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(w.last_mod)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {nextCursor && (
            <button
              type="button"
              onClick={() => load(loadedRange, nextCursor)}
              disabled={loading}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
