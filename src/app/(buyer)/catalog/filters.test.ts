import { describe, it, expect } from 'vitest'
import { catalogHref, parseCatalogFilters } from './filters'

describe('parseCatalogFilters', () => {
  it('reads a trimmed query, the licensable flag and the page', () => {
    expect(parseCatalogFilters({ q: ' news ', licensable: '1', page: '3' })).toEqual({
      filters: { q: 'news', licensableOnly: true },
      page: 3,
    })
  })

  it('defaults to no query, every publication and page 1', () => {
    expect(parseCatalogFilters({})).toEqual({ filters: { q: '', licensableOnly: false }, page: 1 })
    expect(parseCatalogFilters({ licensable: 'yes', page: 'abc' })).toEqual({
      filters: { q: '', licensableOnly: false },
      page: 1,
    })
  })
})

describe('catalogHref', () => {
  it('keeps the filters that are set, then the page', () => {
    expect(catalogHref({ q: 'news', licensableOnly: true }, 3)).toBe(
      '/catalog?q=news&licensable=1&page=3',
    )
    expect(catalogHref({ q: '', licensableOnly: false }, 2)).toBe('/catalog?page=2')
  })

  it.each([
    [{ q: '', licensableOnly: false }, 1],
    [{ q: 'news & views', licensableOnly: true }, 4],
    [{ q: 'café?', licensableOnly: false }, 12],
  ])('parses back to the filters and page it was given: %j, %i', (filters, page) => {
    const qs = new URLSearchParams(catalogHref(filters, page).split('?')[1])
    expect(parseCatalogFilters(Object.fromEntries(qs))).toEqual({ filters, page })
  })
})
