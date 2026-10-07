import Link from 'next/link'
import type { CompanyPurchaseList } from '@ledewire/node'

interface Props {
  pagination: CompanyPurchaseList['pagination']
  /** The URL of a page of the same listing. */
  hrefFor: (page: number) => string
}

/** "Page n of m" with previous/next links, shown only when there is more than one page. */
export default function Pagination({ pagination, hrefFor }: Props) {
  if (pagination.total_pages <= 1) return null
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">
        Page {pagination.current_page} of {pagination.total_pages} · {pagination.total} total
      </span>
      <div className="space-x-4">
        {pagination.prev_page && (
          <Link
            href={hrefFor(pagination.prev_page)}
            className="text-indigo-600 hover:text-indigo-800"
          >
            ← Previous
          </Link>
        )}
        {pagination.next_page && (
          <Link
            href={hrefFor(pagination.next_page)}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  )
}
