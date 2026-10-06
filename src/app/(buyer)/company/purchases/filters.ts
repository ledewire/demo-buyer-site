import type { CompanyPurchase } from '@ledewire/node'

export type SearchParams = Record<string, string | string[] | undefined>

export interface Filters {
  member?: string
  from?: string
  to?: string
  kind?: CompanyPurchase['kind']
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KINDS: CompanyPurchase['kind'][] = ['purchase', 'bulk_acquisition']

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return v?.trim() || undefined
}

/**
 * Reads the Company purchases report filters from the URL, keeping only
 * well-formed values: YYYY-MM-DD dates, known kinds and a positive page.
 */
export function parseFilters(sp: SearchParams): { filters: Filters; page: number } {
  const member = first(sp.member)
  const from = first(sp.from)
  const to = first(sp.to)
  const kind = first(sp.kind)
  const page = Number(first(sp.page))
  return {
    filters: {
      ...(member && { member }),
      ...(from && DATE_RE.test(from) && { from }),
      ...(to && DATE_RE.test(to) && { to }),
      ...(kind &&
        KINDS.includes(kind as CompanyPurchase['kind']) && {
          kind: kind as CompanyPurchase['kind'],
        }),
    },
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}
