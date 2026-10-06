import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockUpdate = vi.fn()
const mockRemove = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { PATCH, DELETE } from './route'
import { AuthError, LedewireError, NotFoundError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

const params = { params: Promise.resolve({ id: 'mem-1' }) }

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/company/members/mem-1', {
    method: 'PATCH',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('/api/company/members/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      company: { members: { update: mockUpdate, remove: mockRemove } },
    } as never)
  })

  describe('PATCH', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuthForRoute).mockResolvedValue(
        NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
      )
      const res = await PATCH(patchRequest({ role: 'admin' }), params)
      expect(res.status).toBe(401)
    })

    it('returns 400 for invalid JSON', async () => {
      const res = await PATCH(patchRequest('nope'), params)
      expect(res.status).toBe(400)
    })

    it('returns 400 when no field is given', async () => {
      const res = await PATCH(patchRequest({}), params)
      expect(res.status).toBe(400)
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('returns 400 for an unknown role', async () => {
      const res = await PATCH(patchRequest({ role: 'owner' }), params)
      expect(res.status).toBe(400)
    })

    it.each([-1, 1.5, '500', null])('returns 400 for cap %s', async (cap) => {
      const res = await PATCH(patchRequest({ daily_spend_limit_cents: cap }), params)
      expect(res.status).toBe(400)
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('updates the role', async () => {
      const member = { id: 'mem-1', role: 'admin' }
      mockUpdate.mockResolvedValue(member)
      const res = await PATCH(patchRequest({ role: 'admin' }), params)
      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith('mem-1', { role: 'admin' })
      expect(await res.json()).toEqual(member)
    })

    it('updates the daily cap, allowing zero', async () => {
      mockUpdate.mockResolvedValue({ id: 'mem-1' })
      await PATCH(patchRequest({ daily_spend_limit_cents: 0 }), params)
      expect(mockUpdate).toHaveBeenCalledWith('mem-1', { daily_spend_limit_cents: 0 })
    })

    it('surfaces a 422 from the API', async () => {
      mockUpdate.mockRejectedValue(new LedewireError('would leave no admin', 422))
      const res = await PATCH(patchRequest({ role: 'member' }), params)
      expect(res.status).toBe(422)
      expect((await res.json()).error).toBe('would leave no admin')
    })
  })

  describe('DELETE', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuthForRoute).mockResolvedValue(
        NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
      )
      const res = await DELETE(new Request('http://localhost'), params)
      expect(res.status).toBe(401)
    })

    it('removes the member', async () => {
      mockRemove.mockResolvedValue(undefined)
      const res = await DELETE(new Request('http://localhost'), params)
      expect(res.status).toBe(200)
      expect(mockRemove).toHaveBeenCalledWith('mem-1')
      expect(await res.json()).toEqual({ ok: true })
    })

    it('returns 404 on NotFoundError', async () => {
      mockRemove.mockRejectedValue(new NotFoundError('gone'))
      const res = await DELETE(new Request('http://localhost'), params)
      expect(res.status).toBe(404)
    })

    it('returns 401 on AuthError', async () => {
      mockRemove.mockRejectedValue(new AuthError('expired'))
      const res = await DELETE(new Request('http://localhost'), params)
      expect(res.status).toBe(401)
    })

    it('returns 500 on unexpected error', async () => {
      mockRemove.mockRejectedValue(new Error('boom'))
      const res = await DELETE(new Request('http://localhost'), params)
      expect(res.status).toBe(500)
    })
  })
})
