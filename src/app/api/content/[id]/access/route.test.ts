import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockGetWithAccess = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))

import { GET } from './route'
import { AuthError, NotFoundError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

function call(id = 'c-1') {
  return GET(new NextRequest(`http://localhost/api/content/${id}/access`), {
    params: Promise.resolve({ id }),
  })
}

describe('GET /api/content/[id]/access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      content: { getWithAccess: mockGetWithAccess },
    } as never)
  })

  it('returns 401 when not authenticated, without calling Ledewire', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await call()
    expect(res.status).toBe(401)
    expect(mockGetWithAccess).not.toHaveBeenCalled()
  })

  it("returns the buyer's preview of the work", async () => {
    const preview = {
      id: 'c-1',
      price_cents: 125,
      access_info: {
        has_sufficient_funds: true,
        next_required_action: 'purchase',
        wallet_balance_cents: 1000,
        remaining_cents: null,
        company_name: null,
      },
    }
    mockGetWithAccess.mockResolvedValue(preview)
    const res = await call('c-1')
    expect(mockGetWithAccess).toHaveBeenCalledWith('c-1')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(preview)
  })

  it('passes a Ledewire refusal through with its status', async () => {
    mockGetWithAccess.mockRejectedValue(new NotFoundError('Content not found'))
    const res = await call()
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Content not found')
  })

  it('returns 401 when the buyer token is refused', async () => {
    mockGetWithAccess.mockRejectedValue(new AuthError('expired'))
    const res = await call()
    expect(res.status).toBe(401)
  })

  it('returns 500 without detail on an unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetWithAccess.mockRejectedValue(new Error('boom'))
    const res = await call()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('An unexpected error occurred')
  })
})
