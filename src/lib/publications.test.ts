import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Publication } from '@ledewire/node'

const mockList = vi.fn()
vi.mock('./ledewire', () => ({
  createBuyerClient: vi.fn(async () => ({ publications: { list: mockList } })),
}))

import { filterPublications, getAllPublications } from './publications'

function pub(overrides: Partial<Publication>): Publication {
  return {
    id: 'p',
    name: 'Pub',
    domains: [],
    bulk_licensable: false,
    coverage_horizon: null,
    ...overrides,
  }
}

const pagination = (next_page: number | null) => ({
  total: 0,
  per_page: 100,
  current_page: 1,
  total_pages: 1,
  next_page,
})

describe('getAllPublications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('walks every page', async () => {
    mockList
      .mockResolvedValueOnce({ data: [pub({ id: '1' })], pagination: pagination(2) })
      .mockResolvedValueOnce({ data: [pub({ id: '2' })], pagination: pagination(null) })
    const result = await getAllPublications()
    expect(result.map((p) => p.id)).toEqual(['1', '2'])
    expect(mockList).toHaveBeenNthCalledWith(2, { page: 2, per_page: 100 })
  })

  it('stops after 20 pages', async () => {
    mockList.mockImplementation(async ({ page }: { page: number }) => ({
      data: [pub({ id: String(page) })],
      pagination: pagination(page + 1),
    }))
    const result = await getAllPublications()
    expect(result).toHaveLength(20)
  })
})

describe('filterPublications', () => {
  const pubs = [
    pub({ id: '1', name: 'Daily Planet', domains: ['dailyplanet.com'], bulk_licensable: true }),
    pub({ id: '2', name: 'Gotham Gazette', domains: ['gazette.example'] }),
  ]

  it('returns everything for an empty query', () => {
    expect(filterPublications(pubs, '  ')).toHaveLength(2)
  })

  it('matches name case-insensitively', () => {
    expect(filterPublications(pubs, 'gotham').map((p) => p.id)).toEqual(['2'])
  })

  it('matches domains', () => {
    expect(filterPublications(pubs, 'PLANET.COM').map((p) => p.id)).toEqual(['1'])
  })

  it('filters to bulk licensable', () => {
    expect(filterPublications(pubs, '', true).map((p) => p.id)).toEqual(['1'])
  })
})
