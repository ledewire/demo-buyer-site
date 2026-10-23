'use client'

import { useEffect } from 'react'
import Markdown from 'react-markdown'
import type { BoughtWork, Delivery } from '@/lib/purchase-delivery'
import { resultTitle } from '@/lib/search'

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
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault()
      // Browsers show their own text, but some still require returnValue to be set.
      e.returnValue = LEAVE_WARNING
      return LEAVE_WARNING
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        ← Back to results
      </button>
      <article className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">{resultTitle(result)}</h2>
        <p className="text-xs text-gray-500">{LEAVE_WARNING}</p>
        <Body delivery={delivery} />
      </article>
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
