'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Markdown from 'react-markdown'
import type { ContentSearchPublication, ContentSearchResultWithPublication } from '@ledewire/node'
import type { Delivery } from '@/lib/purchase-delivery'
import { resultTitle } from '@/lib/search'
import { useExportSelection } from '@/lib/export-selection'

/** A work just bought: the search row it was bought from, and what was delivered. */
export interface BoughtWork {
  result: ContentSearchResultWithPublication
  delivery: Delivery
}

interface Props {
  work: BoughtWork
  onBack: () => void
}

export const LEAVE_WARNING = "You won't be able to view this again without buying it again."

/**
 * A bought work, shown once from memory. LedeWire won't deliver it a second
 * time, so leaving the page loses it — warn before that happens.
 */
export default function ArticleView({ work: { result, delivery }, onBack }: Props) {
  const { url, publication } = result
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault()
      // Browsers show their own text, but some still require returnValue to be set.
      e.returnValue = LEAVE_WARNING
      return LEAVE_WARNING
    }
    // Client-side navigation (next/link) doesn't unload the page, so beforeunload
    // never fires for it: ask first, ahead of the link's own handler (capture phase).
    function confirmInAppLink(e: MouseEvent) {
      if (!leavesInPlace(e)) return
      if (!window.confirm(LEAVE_WARNING)) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    document.addEventListener('click', confirmInAppLink, true)
    return () => {
      window.removeEventListener('beforeunload', warn)
      document.removeEventListener('click', confirmInAppLink, true)
    }
  }, [])

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => {
          if (window.confirm(LEAVE_WARNING)) onBack()
        }}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        ← Back to results
      </button>
      <article className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">{resultTitle(result)}</h2>
        <p className="text-xs text-gray-500">{LEAVE_WARNING}</p>
        <Body delivery={delivery} />
      </article>
      {publication && <PublicationActions url={url} publication={publication} />}
    </div>
  )
}

/**
 * Whether a click follows a same-origin link in this tab, replacing the article
 * in place. A new tab, a download or another site leaves it on screen, or (for
 * another site) is warned about by beforeunload.
 */
function leavesInPlace(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0) return false
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false
  const link = e.target instanceof Element ? e.target.closest('a[href]') : null
  if (!(link instanceof HTMLAnchorElement)) return false
  if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return false
  return link.origin === window.location.origin
}

/**
 * What a buyer sampling a brokered work can do next: add it to the Selection
 * for a bulk licence, or browse its Publication. The search row is the only
 * source of `bulk_licensable` — the purchase response doesn't carry it.
 */
function PublicationActions({
  url,
  publication,
}: {
  url: string | null | undefined
  publication: ContentSearchPublication
}) {
  const selection = useExportSelection()
  const canAdd = publication.bulk_licensable && !!url
  const added = !!url && selection.has(url)
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      {canAdd && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() =>
              selection.add({
                url,
                publicationId: publication.id,
                publicationName: publication.name,
              })
            }
            disabled={added}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {added ? 'Added to selection' : 'Add to selection'}
          </button>
          <p className="text-xs text-gray-500">
            Licensing this work in bulk is a second delivery, charged separately from this purchase.
          </p>
        </div>
      )}
      <Link
        href={`/catalog/${encodeURIComponent(publication.id)}`}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        Browse all from <em>{publication.name}</em>
      </Link>
    </div>
  )
}

function Body({ delivery }: { delivery: Delivery }) {
  const { content_type, content_body, content_uri } = delivery
  if (content_body !== undefined) {
    if (content_type === 'html')
      // POST /api/purchases has already run this through sanitize-html.
      return <div className="article-body" dangerouslySetInnerHTML={{ __html: content_body }} />
    // Markdown, and brokered bodies (whose format the API doesn't pin down;
    // plain text reads the same). No rehype-raw: raw HTML is dropped, not rendered.
    return (
      <div className="article-body">
        <Markdown skipHtml>{content_body}</Markdown>
      </div>
    )
  }
  if (content_uri)
    return (
      <a
        href={content_uri}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
      >
        Open
      </a>
    )
  return <p className="text-sm text-gray-500">Nothing was delivered that this page can show.</p>
}
