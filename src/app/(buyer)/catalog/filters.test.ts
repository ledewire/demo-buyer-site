import { describe, it, expect } from 'vitest'
import { catalogHref, parseCatalogFilters, type CatalogFilters } from './filters'

describe('parseCatalogFilters', () => {
  it('reads a trimmed query, the licensable flag and the page', () => {
    expect(parseCatalogFilters({ q: ' news ', licensable: '1', page: '3' })).toEqual({
      filters: { q: 'news', licensableOnly: true, topic: null },
      page: 3,
    })
  })

  it('defaults to no query, every publication and page 1', () => {
    expect(parseCatalogFilters({})).toEqual({
      filters: { q: '', licensableOnly: false, topic: null },
      page: 1,
    })
    expect(parseCatalogFilters({ licensable: 'yes', page: 'abc' })).toEqual({
      filters: { q: '', licensableOnly: false, topic: null },
      page: 1,
    })
  })

  it('reads a topic slug', () => {
    expect(parseCatalogFilters({ topic: 'food-and-drink' }).filters.topic).toBe('food-and-drink')
  })

  it.each(['', 'gardening', 'Sports', 'toString'])('ignores topic=%j', (topic) => {
    expect(parseCatalogFilters({ topic }).filters.topic).toBeNull()
  })
})

describe('catalogHref', () => {
  it('keeps the filters that are set, then the page', () => {
    expect(catalogHref({ q: 'news', licensableOnly: true, topic: 'sports' }, 3)).toBe(
      '/catalog?q=news&licensable=1&topic=sports&page=3',
    )
    expect(catalogHref({ q: '', licensableOnly: false, topic: null }, 2)).toBe('/catalog?page=2')
  })

  it.each<[CatalogFilters, number]>([
    [{ q: '', licensableOnly: false, topic: null }, 1],
    [{ q: 'news & views', licensableOnly: true, topic: null }, 4],
    [{ q: 'café?', licensableOnly: false, topic: 'travel' }, 12],
    [{ q: '', licensableOnly: false, topic: 'business-and-finance' }, 2],
  ])('parses back to the filters and page it was given: %j, %i', (filters, page) => {
    const qs = new URLSearchParams(catalogHref(filters, page).split('?')[1])
    expect(parseCatalogFilters(Object.fromEntries(qs))).toEqual({ filters, page })
  })
})
