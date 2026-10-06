import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockListWorks = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))

import { GET } from './route'
import { LedewireError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

function call(query = '') {
  return GET(new NextRequest(`http://localhost/api/publications/pub-1/works${query}`), {
    params: Promise.resolve({ id: 'pub-1' }),
  })
}

describe('GET /api/publications/[id]/works', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      publications: { listWorks: mockListWorks },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await call()
    expect(res.status).toBe(401)
  })

  it('passes date range and cursor through', async () => {
    const page = { publication_id: 'pub-1', works: [], next_cursor: null, date_filter: 'applied' }
    mockListWorks.mockResolvedValue(page)
    const res = await call('?from=2026-01-01&to=2026-01-31&cursor=abc')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(page)
    expect(mockListWorks).toHaveBeenCalledWith('pub-1', {
      from: '2026-01-01',
      to: '2026-01-31',
      cursor: 'abc',
      limit: 200,
    })
  })

  it('omits empty params', async () => {
    mockListWorks.mockResolvedValue({ works: [] })
    await call('?from=&to=')
    expect(mockListWorks).toHaveBeenCalledWith('pub-1', {
      from: undefined,
      to: undefined,
      cursor: undefined,
      limit: 200,
    })
  })

  it('rejects malformed dates', async () => {
    const res = await call('?from=01/01/2026')
    expect(res.status).toBe(400)
    expect(mockListWorks).not.toHaveBeenCalled()
  })

  it('surfaces rate limiting as 429', async () => {
    mockListWorks.mockRejectedValue(new LedewireError('slow down', 429))
    const res = await call()
    expect(res.status).toBe(429)
  })
})
