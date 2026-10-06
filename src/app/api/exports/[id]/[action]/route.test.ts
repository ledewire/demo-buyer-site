import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const acquisitions = {
  acknowledgeExclusions: vi.fn(),
  authorize: vi.fn(),
  requote: vi.fn(),
  cancel: vi.fn(),
}

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))

import { POST } from './route'
import { LedewireError, SpendCapReachedError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

const call = (action: string) =>
  POST(new Request('http://localhost', { method: 'POST' }), {
    params: Promise.resolve({ id: 'acq-1', action }),
  })

describe('POST /api/exports/[id]/[action]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({ acquisitions } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    expect((await call('authorize')).status).toBe(401)
  })

  it.each([
    ['acknowledge', 'acknowledgeExclusions'],
    ['authorize', 'authorize'],
    ['requote', 'requote'],
    ['cancel', 'cancel'],
  ] as const)('maps %s to acquisitions.%s', async (action, method) => {
    acquisitions[method].mockResolvedValue({ id: 'acq-1', status: 'authorized' })
    const res = await call(action)
    expect(res.status).toBe(200)
    expect(acquisitions[method]).toHaveBeenCalledWith('acq-1')
  })

  it.each(['delete', 'constructor', 'toString'])('returns 404 for %s', async (action) => {
    expect((await call(action)).status).toBe(404)
  })

  it('passes the refusal type through', async () => {
    acquisitions.authorize.mockRejectedValue(
      new LedewireError('Quote expired', 409, undefined, 'quote_expired'),
    )
    const res = await call('authorize')
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ type: 'quote_expired' })
  })

  it('maps the daily spend cap to 402 with resets_at', async () => {
    acquisitions.authorize.mockRejectedValue(
      new SpendCapReachedError('cap reached', {
        capCents: 1000,
        spentCents: 1000,
        remainingCents: 0,
        resetsAt: '2026-10-07T00:00:00Z',
        bulkExempt: false,
      }),
    )
    const res = await call('authorize')
    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({
      type: 'daily_spend_cap_reached',
      resets_at: '2026-10-07T00:00:00Z',
    })
  })
})
