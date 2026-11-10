import Link from 'next/link'
import type { TopicSlug } from '@ledewire/node'
import { requireAuth } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { createBuyerClient, type BuyerClient } from '@/lib/ledewire'
import { renderFetchError } from '@/lib/page-errors'
import { TOPIC_SLUGS, topicLabel } from '@/lib/work-labels'
import ExportSelectionSummary from '@/components/ExportSelectionSummary'
import Pagination from '@/components/Pagination'
import TopicPills from '@/components/TopicPills'
import {
  catalogHref,
  parseCatalogFilters,
  type CatalogFilters,
  type CatalogSearchParams,
} from './filters'

const PER_PAGE = 50

interface Props {
  searchParams: Promise<CatalogSearchParams>
}

interface TopicOption {
  slug: TopicSlug
  /** How many listed publications carry it; null when the Topic directory couldn't be read. */
  publicationCount: number | null
}

/**
 * The topic filter's options, from the Topic directory. The catalog doesn't need the
 * directory to list publications, so when it can't be read the filter still offers every
 * Topic the SDK knows, just without counts.
 */
async function loadTopicOptions(client: BuyerClient) {
  try {
    const { data } = await client.topics.list()
    return data.map((t): TopicOption => ({ slug: t.slug, publicationCount: t.publication_count }))
  } catch (err) {
    console.error('[catalog] Topic directory read failed', err)
    return TOPIC_SLUGS.map((slug): TopicOption => ({ slug, publicationCount: null }))
  }
}

async function loadCatalog({ q, licensableOnly, topic }: CatalogFilters, page: number) {
  const client = await createBuyerClient()
  const [{ data: publications, pagination, unclassified_count }, topicOptions] = await Promise.all([
    // `bulk_licensable: false` would mean non-licensable only, so leave it unset unless filtering.
    client.publications.list({
      page,
      per_page: PER_PAGE,
      ...(q && { q }),
      ...(licensableOnly && { bulk_licensable: true }),
      ...(topic && { topics: [topic] }),
    }),
    loadTopicOptions(client),
  ])
  return { publications, pagination, unclassifiedCount: unclassified_count, topicOptions }
}

export default async function CatalogPage({ searchParams }: Props) {
  await requireAuth()
  const { filters, page } = parseCatalogFilters(await searchParams)
  const { q, licensableOnly, topic } = filters

  let data: Awaited<ReturnType<typeof loadCatalog>>
  try {
    data = await loadCatalog(filters, page)
  } catch (err) {
    return renderFetchError(err)
  }
  const { publications, pagination, unclassifiedCount, topicOptions } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Catalog</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search publications, pick articles, and export them in bulk as a licensed corpus.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <label htmlFor="q" className="sr-only">
          Search publications
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Publication name or domain"
          className="w-full sm:w-80 rounded-md border-gray-300 text-sm shadow-xs focus:border-indigo-500 focus:ring-indigo-500"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="licensable"
            value="1"
            defaultChecked={licensableOnly}
            className="rounded-sm border-gray-300 text-indigo-600"
          />
          Bulk licensable only
        </label>
        <label htmlFor="topic" className="sr-only">
          Topic
        </label>
        <select
          id="topic"
          name="topic"
          defaultValue={topic ?? ''}
          className="rounded-md border-gray-300 text-sm shadow-xs focus:border-indigo-500 focus:ring-indigo-500"
        >
          <option value="">All topics</option>
          {topicOptions.map((t) => (
            <option key={t.slug} value={t.slug}>
              {topicLabel(t.slug)}
              {t.publicationCount !== null && ` (${t.publicationCount})`}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Search
        </button>
      </form>

      {topic && unclassifiedCount > 0 && (
        <p className="text-sm text-gray-500">
          Publications with no topics yet never match a topic filter ({unclassifiedCount} in the
          catalog), so this list may be missing some.
        </p>
      )}

      <ExportSelectionSummary />

      {publications.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">No publications match.</p>
      ) : (
        <ul className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {publications.map((p) => (
            <li key={p.id}>
              <Link
                href={`/catalog/${encodeURIComponent(p.id)}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500 truncate">{p.domains.join(', ')}</p>
                  <TopicPills topics={p.topics} className="mt-1" />
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {p.coverage_horizon && (
                    <span className="text-gray-500">
                      Coverage back to {formatDate(p.coverage_horizon.horizon_at)}
                    </span>
                  )}
                  {p.bulk_licensable && (
                    <span className="font-medium px-2 py-0.5 rounded-full text-green-700 bg-green-50">
                      Bulk licensable
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination pagination={pagination} hrefFor={(n) => catalogHref(filters, n)} />
    </div>
  )
}
