import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockSearch = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))

import { GET } from './route'
import { LedewireError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

function call(query = '') {
  return GET(new NextRequest(`http://localhost/api/search${query}`))
}

const page = { data: [], next_cursor: null, partial_results: false, unavailable_providers: [] }

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      content: { search: mockSearch },
    } as never)
    mockSearch.mockResolvedValue(page)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await call('?q=x')
    expect(res.status).toBe(401)
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('passes query, max_price_cents and cursor through', async () => {
    const res = await call('?q=climate&max_price=1.50&cursor=abc')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(page)
    expect(mockSearch).toHaveBeenCalledWith({
      query: 'climate',
      max_price_cents: 150,
      cursor: 'abc',
    })
  })

  it('omits a blank max price and cursor', async () => {
    await call('?q=climate&max_price=&cursor=')
    expect(mockSearch).toHaveBeenCalledWith({ query: 'climate' })
  })

  it('rejects a missing query', async () => {
    const res = await call('?q=%20')
    expect(res.status).toBe(400)
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('rejects a max price that is not a dollar amount', async () => {
    const res = await call('?q=x&max_price=cheap')
    expect(res.status).toBe(400)
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('keeps a 429 a 429, with Retry-After from retryAfter', async () => {
    mockSearch.mockRejectedValue(
      new LedewireError('slow down', 429, undefined, undefined, undefined, 42),
    )
    const res = await call('?q=x')
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
  })

  it('keeps a 422 (an expired cursor) a 422', async () => {
    mockSearch.mockRejectedValue(new LedewireError('cursor expired', 422))
    const res = await call('?q=x&cursor=old')
    expect(res.status).toBe(422)
  })

  it('maps an unexpected error to 500', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSearch.mockRejectedValue(new Error('boom'))
    const res = await call('?q=x')
    expect(res.status).toBe(500)
    spy.mockRestore()
  })
})
