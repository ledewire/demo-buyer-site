import type { TopicSlug } from '@ledewire/node'
import { parsePage } from '@/lib/pagination'
import { isTopicSlug } from '@/lib/work-labels'

export interface CatalogFilters {
  /** The trimmed search text; empty for every publication. */
  q: string
  /** Only publications that can be bulk licensed. */
  licensableOnly: boolean
  /** Only publications carrying this Topic; null for every Topic. */
  topic: TopicSlug | null
}

export interface CatalogSearchParams {
  q?: string
  licensable?: string
  topic?: string
  page?: string
}

/** Reads the catalog's search filters and page from the URL. An unknown topic is ignored. */
export function parseCatalogFilters(sp: CatalogSearchParams): {
  filters: CatalogFilters
  page: number
} {
  return {
    filters: {
      q: sp.q?.trim() ?? '',
      licensableOnly: sp.licensable === '1',
      topic: sp.topic && isTopicSlug(sp.topic) ? sp.topic : null,
    },
    page: parsePage(sp.page),
  }
}

/** The catalog URL for `page`, keeping the filters; `parseCatalogFilters` reads it back. */
export function catalogHref({ q, licensableOnly, topic }: CatalogFilters, page: number): string {
  const qs = new URLSearchParams()
  if (q) qs.set('q', q)
  if (licensableOnly) qs.set('licensable', '1')
  if (topic) qs.set('topic', topic)
  qs.set('page', String(page))
  return `/catalog?${qs.toString()}`
}
