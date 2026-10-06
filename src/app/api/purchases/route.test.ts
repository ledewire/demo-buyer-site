import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockPurchasesList = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { GET } from './route'
import { AuthError, LedewireError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

describe('GET /api/purchases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      purchases: { list: mockPurchasesList },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns list of purchases', async () => {
    const purchases = [{ id: 'p1', content_id: 'c1' }]
    mockPurchasesList.mockResolvedValue(purchases)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(purchases)
  })

  it('unwraps a paginated envelope', async () => {
    const purchases = [{ id: 'p1', content_id: 'c1' }]
    mockPurchasesList.mockResolvedValue({ data: purchases, pagination: { total: 1 } })
    const res = await GET()
    expect(await res.json()).toEqual(purchases)
  })

  it('returns 401 on AuthError', async () => {
    mockPurchasesList.mockRejectedValue(new AuthError('expired'))
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns status from LedewireError', async () => {
    mockPurchasesList.mockRejectedValue(new LedewireError('forbidden', 403))
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 500 on unexpected error', async () => {
    mockPurchasesList.mockRejectedValue(new Error('boom'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
