import { describe, it, expect } from 'vitest'
import { parseSearchFilters, retryAfterSeconds, searchQueryString } from './search'

describe('parseSearchFilters', () => {
  it('is null with no query to search for', () => {
    expect(parseSearchFilters(undefined, '1')).toBeNull()
    expect(parseSearchFilters('   ', '1')).toBeNull()
  })

  it('trims the query and turns a dollar max price into cents', () => {
    expect(parseSearchFilters(' ocean ', '1.50')).toEqual({ query: 'ocean', max_price_cents: 150 })
  })

  it('treats a blank max price as no limit, and $0 as a limit', () => {
    expect(parseSearchFilters('ocean', ' ')).toEqual({ query: 'ocean' })
    expect(parseSearchFilters('ocean', '0')).toEqual({ query: 'ocean', max_price_cents: 0 })
  })

  it('refuses a max price that is not a dollar amount of 0 or more', () => {
    expect(parseSearchFilters('ocean', 'cheap')).toEqual({
      error: 'Enter a max price of $0 or more',
    })
    expect(parseSearchFilters('ocean', '-1')).toEqual({ error: 'Enter a max price of $0 or more' })
  })
})

describe('searchQueryString', () => {
  it('encodes the filters as typed, then the cursor', () => {
    expect(searchQueryString('ocean heat', '1.50', 'cur-1')).toBe(
      'q=ocean+heat&max_price=1.50&cursor=cur-1',
    )
  })

  it('leaves out a blank max price and a missing cursor', () => {
    expect(searchQueryString('ocean', '')).toBe('q=ocean')
  })

  it.each([
    ['ocean', ''],
    [' ocean & reefs ', '1.50'],
    ['café?', '0'],
    ['ocean', 'cheap'],
  ])('parses back to the filters it was given: %j, %j', (q, maxPrice) => {
    const qs = new URLSearchParams(searchQueryString(q, maxPrice, 'c/1+2'))
    expect(parseSearchFilters(qs.get('q'), qs.get('max_price'))).toEqual(
      parseSearchFilters(q, maxPrice),
    )
    expect(qs.get('cursor')).toBe('c/1+2')
  })
})

describe('retryAfterSeconds', () => {
  it('rounds a wait up to whole seconds', () => {
    expect(retryAfterSeconds(30)).toBe(30)
    expect(retryAfterSeconds('1.5')).toBe(2)
  })

  it('waits a minute when the wait is missing, zero or not a number', () => {
    for (const v of [undefined, null, 0, -3, 'soon']) expect(retryAfterSeconds(v)).toBe(60)
  })
})
