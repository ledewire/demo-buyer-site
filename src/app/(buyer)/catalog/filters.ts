import { parsePage } from '@/lib/pagination'

export interface CatalogFilters {
  /** The trimmed search text; empty for every publication. */
  q: string
  /** Only publications that can be bulk licensed. */
  licensableOnly: boolean
}

/** Reads the catalog's search filters and page from the URL. */
export function parseCatalogFilters(sp: { q?: string; licensable?: string; page?: string }): {
  filters: CatalogFilters
  page: number
} {
  return {
    filters: { q: sp.q?.trim() ?? '', licensableOnly: sp.licensable === '1' },
    page: parsePage(sp.page),
  }
}

/** The catalog URL for `page`, keeping the filters; `parseCatalogFilters` reads it back. */
export function catalogHref({ q, licensableOnly }: CatalogFilters, page: number): string {
  const qs = new URLSearchParams()
  if (q) qs.set('q', q)
  if (licensableOnly) qs.set('licensable', '1')
  qs.set('page', String(page))
  return `/catalog?${qs.toString()}`
}
