'use client'

import Link from 'next/link'
import { useExportSelection } from '@/lib/export-selection'

/** A banner linking to the export review page while the Selection is non-empty. */
export default function ExportSelectionSummary() {
  const { items } = useExportSelection()
  if (items.length === 0) return null

  const publications = new Set(items.map((w) => w.publicationId)).size
  return (
    <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
      <p className="text-sm text-indigo-900">
        {items.length} {items.length === 1 ? 'article' : 'articles'} selected from {publications}{' '}
        {publications === 1 ? 'publication' : 'publications'}
      </p>
      <Link
        href="/exports/new"
        className="text-sm font-medium text-indigo-700 hover:text-indigo-900 underline"
      >
        Review export
      </Link>
    </div>
  )
}
