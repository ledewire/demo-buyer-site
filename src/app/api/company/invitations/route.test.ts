import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockList = vi.fn()
const mockCreate = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { GET, POST } from './route'
import { AuthError, ForbiddenError, LedewireError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/company/invitations', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('/api/company/invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      company: { invitations: { list: mockList, create: mockCreate } },
    } as never)
  })

  describe('GET', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuthForRoute).mockResolvedValue(
        NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
      )
      const res = await GET()
      expect(res.status).toBe(401)
    })

    it('returns the invitation list', async () => {
      const list = { data: [{ id: 'inv-1', email: 'a@b.co' }] }
      mockList.mockResolvedValue(list)
      const res = await GET()
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(list)
    })

    it('returns 403 for a non-admin', async () => {
      mockList.mockRejectedValue(new ForbiddenError('admins only'))
      const res = await GET()
      expect(res.status).toBe(403)
    })

    it('returns 500 on unexpected error', async () => {
      mockList.mockRejectedValue(new Error('boom'))
      const res = await GET()
      expect(res.status).toBe(500)
    })
  })

  describe('POST', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(requireAuthForRoute).mockResolvedValue(
        NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
      )
      const res = await POST(postRequest({ email: 'a@b.co' }))
      expect(res.status).toBe(401)
    })

    it('returns 400 for invalid JSON', async () => {
      const res = await POST(postRequest('not json'))
      expect(res.status).toBe(400)
    })

    it('returns 400 when email is missing', async () => {
      const res = await POST(postRequest({ role: 'member' }))
      expect(res.status).toBe(400)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('returns 400 for an unknown role', async () => {
      const res = await POST(postRequest({ email: 'a@b.co', role: 'owner' }))
      expect(res.status).toBe(400)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('creates an invitation without a role', async () => {
      const invitation = { id: 'inv-1', email: 'a@b.co', role: 'member' }
      mockCreate.mockResolvedValue(invitation)
      const res = await POST(postRequest({ email: ' a@b.co ' }))
      expect(res.status).toBe(201)
      expect(mockCreate).toHaveBeenCalledWith({ email: 'a@b.co' })
      expect(await res.json()).toEqual(invitation)
    })

    it('passes the role through', async () => {
      mockCreate.mockResolvedValue({ id: 'inv-1' })
      await POST(postRequest({ email: 'a@b.co', role: 'admin' }))
      expect(mockCreate).toHaveBeenCalledWith({ email: 'a@b.co', role: 'admin' })
    })

    it('returns 401 on AuthError', async () => {
      mockCreate.mockRejectedValue(new AuthError('expired'))
      const res = await POST(postRequest({ email: 'a@b.co' }))
      expect(res.status).toBe(401)
    })

    it('returns status from LedewireError', async () => {
      mockCreate.mockRejectedValue(new LedewireError('already invited', 409))
      const res = await POST(postRequest({ email: 'a@b.co' }))
      expect(res.status).toBe(409)
      expect((await res.json()).error).toBe('already invited')
    })
  })
})
