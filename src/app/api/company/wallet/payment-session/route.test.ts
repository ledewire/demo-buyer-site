import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockCreatePaymentSession = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { POST } from './route'
import { AuthError, ForbiddenError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/company/wallet/payment-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/company/wallet/payment-session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      company: { wallet: { createPaymentSession: mockCreatePaymentSession } },
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
    const req = new NextRequest('http://localhost/api/company/wallet/payment-session', {
      method: 'POST',
      body: 'bad',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it.each([0, -100, 10.5, '1000'])('returns 400 for amount_cents %p', async (amount_cents) => {
    const res = await POST(makeRequest({ amount_cents }))
    expect(res.status).toBe(400)
    expect(mockCreatePaymentSession).not.toHaveBeenCalled()
  })

  it('creates a Company payment session', async () => {
    const session = { client_secret: 'pi_secret', session_id: 'sess_1', public_key: 'pk_test' }
    mockCreatePaymentSession.mockResolvedValue(session)
    const res = await POST(makeRequest({ amount_cents: 5000 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(session)
    expect(mockCreatePaymentSession).toHaveBeenCalledWith({ amount_cents: 5000, currency: 'usd' })
  })

  it('returns 403 when the caller is not a Company admin', async () => {
    mockCreatePaymentSession.mockRejectedValue(new ForbiddenError('admins only'))
    const res = await POST(makeRequest({ amount_cents: 1000 }))
    expect(res.status).toBe(403)
  })

  it('returns 401 on AuthError', async () => {
    mockCreatePaymentSession.mockRejectedValue(new AuthError('expired'))
    const res = await POST(makeRequest({ amount_cents: 1000 }))
    expect(res.status).toBe(401)
  })
})
