import { redirect } from 'next/navigation'
import { AuthError, LedewireError } from '@ledewire/node'
import type { ContentSearchResponse } from '@ledewire/node'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { parseSearchFilters, retryAfterSeconds } from '@/lib/search'
import ExportSelectionSummary from '@/components/ExportSelectionSummary'
import ContentSearch from './ContentSearch'

interface Props {
  searchParams: Promise<{ q?: string; max_price?: string }>
}

type FirstPage =
  | { page: ContentSearchResponse }
  | { retryAfter: number }
  | { error: string }
  | Record<string, never>

/** The first page of a search from the URL, or why there isn't one. */
async function searchFirstPage(q: string, maxPrice: string): Promise<FirstPage> {
  const filters = parseSearchFilters(q, maxPrice)
  if (!filters) return {}
  if ('error' in filters) return { error: filters.error }
  try {
    const client = await createBuyerClient()
    return { page: await client.content.search(filters) }
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    if (err instanceof LedewireError) {
      if (err.statusCode === 429) return { retryAfter: retryAfterSeconds(err.retryAfter) }
      return { error: `API error: ${err.message}` }
    }
    throw err
  }
}

export default async function SearchPage({ searchParams }: Props) {
  await requireAuth()
  const { q = '', max_price = '' } = await searchParams
  const first = await searchFirstPage(q, max_price)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search articles across every store and set the most you&apos;d pay for one.
        </p>
      </div>

      <ExportSelectionSummary />

      <ContentSearch
        q={q}
        maxPrice={max_price}
        initialPage={'page' in first ? first.page : null}
        initialRetryAfter={'retryAfter' in first ? first.retryAfter : undefined}
        initialError={'error' in first ? first.error : undefined}
      />
    </div>
  )
}
