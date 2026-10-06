import { describe, it, expect } from 'vitest'
import { parseFilters } from './filters'

describe('parseFilters', () => {
  it('defaults to page 1 with no filters', () => {
    expect(parseFilters({})).toEqual({ filters: {}, page: 1 })
  })

  it('keeps valid filters', () => {
    expect(
      parseFilters({
        member: 'mem-1',
        from: '2026-01-01',
        to: '2026-01-31',
        kind: 'bulk_acquisition',
        page: '3',
      }),
    ).toEqual({
      filters: { member: 'mem-1', from: '2026-01-01', to: '2026-01-31', kind: 'bulk_acquisition' },
      page: 3,
    })
  })

  it('drops malformed values', () => {
    expect(
      parseFilters({
        member: '  ',
        from: '01/01/2026',
        to: 'tomorrow',
        kind: 'refund',
        page: '-2',
      }),
    ).toEqual({ filters: {}, page: 1 })
  })

  it.each(['0', '1.5', 'abc'])('falls back to page 1 for %s', (page) => {
    expect(parseFilters({ page }).page).toBe(1)
  })

  it('uses the first value of a repeated param', () => {
    expect(parseFilters({ kind: ['purchase', 'bulk_acquisition'] }).filters.kind).toBe('purchase')
  })
})
