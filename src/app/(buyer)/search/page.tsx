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
  | { kind: 'none' }
  | { kind: 'page'; page: ContentSearchResponse }
  | { kind: 'rateLimited'; retryAfter: number }
  | { kind: 'error'; error: string }

/** The first page of a search from the URL, or why there isn't one. */
async function searchFirstPage(q: string, maxPrice: string): Promise<FirstPage> {
  const filters = parseSearchFilters(q, maxPrice)
  if (!filters) return { kind: 'none' }
  if ('error' in filters) return { kind: 'error', error: filters.error }
  try {
    const client = await createBuyerClient()
    return { kind: 'page', page: await client.content.search(filters) }
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    if (err instanceof LedewireError) {
      if (err.statusCode === 429)
        return { kind: 'rateLimited', retryAfter: retryAfterSeconds(err.retryAfter) }
      return { kind: 'error', error: `API error: ${err.message}` }
    }
    throw err
  }
}

export default async function SearchPage({ searchParams }: Props) {
  await requireAuth()
  const { q = '', max_price = '' } = await searchParams
  const firstPage = await searchFirstPage(q, max_price)

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
        initialPage={firstPage.kind === 'page' ? firstPage.page : null}
        initialRetryAfter={firstPage.kind === 'rateLimited' ? firstPage.retryAfter : undefined}
        initialError={firstPage.kind === 'error' ? firstPage.error : undefined}
      />
    </div>
  )
}
