import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockBalance = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { GET } from './route'
import { AuthError, LedewireError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

describe('GET /api/wallet/balance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({ wallet: { balance: mockBalance } } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns wallet balance', async () => {
    const balance = { balance_cents: 5000, currency: 'usd' }
    mockBalance.mockResolvedValue(balance)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(balance)
  })

  it('returns 401 on AuthError', async () => {
    mockBalance.mockRejectedValue(new AuthError('expired'))
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns status from LedewireError', async () => {
    mockBalance.mockRejectedValue(new LedewireError('service error', 503))
    const res = await GET()
    expect(res.status).toBe(503)
  })

  it('returns 500 on unexpected error', async () => {
    mockBalance.mockRejectedValue(new Error('boom'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
