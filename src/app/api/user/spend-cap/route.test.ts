import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { ForbiddenError } from '@ledewire/node'

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

import { PATCH } from './route'
import { requireAuthForRoute } from '@/lib/route-auth'
import { mockUserSpendCap } from '@/__mocks__/ledewire-client'

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/user/spend-cap', {
    method: 'PATCH',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('/api/user/spend-cap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
  })

  describe('PATCH', () => {
    it('refuses a null cap without calling the SDK', async () => {
      const res = await PATCH(patchRequest({ daily_spend_limit_cents: null }))
      expect(res.status).toBe(400)
      expect(mockUserSpendCap.update).not.toHaveBeenCalled()
    })

    it.each([
      ['missing', {}],
      ['negative', { daily_spend_limit_cents: -1 }],
      ['fractional', { daily_spend_limit_cents: 12.5 }],
      ['string', { daily_spend_limit_cents: '500' }],
    ])('refuses a %s cap without calling the SDK', async (_label, body) => {
      const res = await PATCH(patchRequest(body))
      expect(res.status).toBe(400)
      expect(mockUserSpendCap.update).not.toHaveBeenCalled()
    })

    it('returns 400 for invalid JSON', async () => {
      const res = await PATCH(patchRequest('nope'))
      expect(res.status).toBe(400)
    })

    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuthForRoute).mockResolvedValue(
        NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
      )
      const res = await PATCH(patchRequest({ daily_spend_limit_cents: 500 }))
      expect(res.status).toBe(401)
      expect(mockUserSpendCap.update).not.toHaveBeenCalled()
    })

    it('sets the cap and returns the updated spend cap', async () => {
      mockUserSpendCap.update.mockResolvedValue({ cap_cents: 2000 } as never)
      const res = await PATCH(patchRequest({ daily_spend_limit_cents: 2000 }))
      expect(res.status).toBe(200)
      expect(mockUserSpendCap.update).toHaveBeenCalledWith({ daily_spend_limit_cents: 2000 })
      expect(await res.json()).toEqual({ cap_cents: 2000 })
    })

    it('accepts a cap of zero', async () => {
      mockUserSpendCap.update.mockResolvedValue({ cap_cents: 0 } as never)
      const res = await PATCH(patchRequest({ daily_spend_limit_cents: 0 }))
      expect(res.status).toBe(200)
      expect(mockUserSpendCap.update).toHaveBeenCalledWith({ daily_spend_limit_cents: 0 })
    })

    it("passes on the API's refusal for a Company member", async () => {
      mockUserSpendCap.update.mockRejectedValue(
        new ForbiddenError('A Company admin sets your daily spend cap'),
      )
      const res = await PATCH(patchRequest({ daily_spend_limit_cents: 500 }))
      expect(res.status).toBe(403)
      expect(await res.json()).toMatchObject({ error: 'A Company admin sets your daily spend cap' })
    })
  })
})
