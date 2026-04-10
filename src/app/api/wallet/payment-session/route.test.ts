import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockCreatePaymentSession = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { POST } from './route'
import { AuthError, LedewireError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/wallet/payment-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/wallet/payment-session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      wallet: { createPaymentSession: mockCreatePaymentSession },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await POST(makeRequest({ amount_cents: 1000 }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/wallet/payment-session', {
      method: 'POST',
      body: 'bad',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when amount_cents is missing or zero', async () => {
    const res = await POST(makeRequest({ amount_cents: 0 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('amount_cents') })
  })

  it('creates payment session and returns 200', async () => {
    const session = { client_secret: 'pi_secret', session_id: 'sess_1', public_key: 'pk_test' }
    mockCreatePaymentSession.mockResolvedValue(session)
    const res = await POST(makeRequest({ amount_cents: 1000, currency: 'usd' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(session)
    expect(mockCreatePaymentSession).toHaveBeenCalledWith({ amount_cents: 1000, currency: 'usd' })
  })

  it('uses default currency usd when not provided', async () => {
    mockCreatePaymentSession.mockResolvedValue({})
    await POST(makeRequest({ amount_cents: 500 }))
    expect(mockCreatePaymentSession).toHaveBeenCalledWith({ amount_cents: 500, currency: 'usd' })
  })

  it('returns 401 on AuthError', async () => {
    mockCreatePaymentSession.mockRejectedValue(new AuthError('expired'))
    const res = await POST(makeRequest({ amount_cents: 1000 }))
    expect(res.status).toBe(401)
  })

  it('returns status from LedewireError', async () => {
    mockCreatePaymentSession.mockRejectedValue(new LedewireError('bad request', 422))
    const res = await POST(makeRequest({ amount_cents: 1000 }))
    expect(res.status).toBe(422)
  })

  it('returns 500 on unexpected error', async () => {
    mockCreatePaymentSession.mockRejectedValue(new Error('boom'))
    const res = await POST(makeRequest({ amount_cents: 1000 }))
    expect(res.status).toBe(500)
  })
})
