'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useExportSelection, type SelectedWork } from '@/lib/export-selection'

export default function ExportReview() {
  const router = useRouter()
  const { items, remove, clear } = useExportSelection()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const groups = useMemo(() => {
    const byPublication = new Map<string, { name: string; works: SelectedWork[] }>()
    for (const w of items) {
      const group = byPublication.get(w.publicationId) ?? { name: w.publicationName, works: [] }
      group.works.push(w)
      byPublication.set(w.publicationId, group)
    }
    return [...byPublication.entries()]
  }, [items])

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: items.map((w) => w.url) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to request a quote')
        return
      }
      clear()
      router.push(`/exports/${encodeURIComponent(data.id)}`)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">No articles selected.</p>
        <Link href="/catalog" className="text-sm text-indigo-600 hover:text-indigo-800 underline">
          Browse the catalog
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 py-2 rounded-md shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Requesting…' : `Request quote for ${items.length} articles`}
        </button>
        <button
          onClick={() => {
            if (confirm('Remove every article from this export?')) clear()
          }}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          Clear all
        </button>
        <Link href="/catalog" className="text-sm text-indigo-600 hover:text-indigo-800">
          Add more from the catalog
        </Link>
      </div>

      {groups.map(([publicationId, group]) => (
        <section key={publicationId} className="bg-white border border-gray-200 rounded-lg">
          <h2 className="px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-100">
            {group.name} <span className="font-normal text-gray-500">({group.works.length})</span>
          </h2>
          <ul className="divide-y divide-gray-100">
            {group.works.map((w) => (
              <li key={w.url} className="flex items-center justify-between gap-4 px-4 py-2">
                <span className="text-sm text-gray-800 break-all">{w.url}</span>
                <button
                  onClick={() => remove(w.url)}
                  aria-label={`Remove ${w.url}`}
                  className="text-sm text-red-600 hover:text-red-800 shrink-0"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
