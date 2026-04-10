import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockGetPaymentStatus = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { GET } from './route'
import { AuthError, LedewireError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

const params = { params: Promise.resolve({ sessionId: 'sess_abc' }) }

describe('GET /api/wallet/payment-status/[sessionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      wallet: { getPaymentStatus: mockGetPaymentStatus },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await GET(new Request('http://localhost'), params)
    expect(res.status).toBe(401)
  })

  it('returns payment status', async () => {
    const status = { status: 'succeeded', amount_cents: 1000 }
    mockGetPaymentStatus.mockResolvedValue(status)
    const res = await GET(new Request('http://localhost'), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(status)
    expect(mockGetPaymentStatus).toHaveBeenCalledWith('sess_abc')
  })

  it('returns 401 on AuthError', async () => {
    mockGetPaymentStatus.mockRejectedValue(new AuthError('expired'))
    const res = await GET(new Request('http://localhost'), params)
    expect(res.status).toBe(401)
  })

  it('returns status from LedewireError', async () => {
    mockGetPaymentStatus.mockRejectedValue(new LedewireError('not found', 404))
    const res = await GET(new Request('http://localhost'), params)
    expect(res.status).toBe(404)
  })

  it('returns 500 on unexpected error', async () => {
    mockGetPaymentStatus.mockRejectedValue(new Error('boom'))
    const res = await GET(new Request('http://localhost'), params)
    expect(res.status).toBe(500)
  })
})
