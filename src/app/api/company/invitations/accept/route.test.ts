import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockAccept = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { POST } from './route'
import { AuthError, LedewireError, NotFoundError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/company/invitations/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/company/invitations/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      company: { invitations: { accept: mockAccept } },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await POST(makeRequest({ token: 'tok' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/company/invitations/accept', {
      method: 'POST',
      body: 'bad',
    })
    expect((await POST(req)).status).toBe(400)
  })

  it.each([{}, { token: '' }, { token: '   ' }, { token: 42 }])(
    'returns 400 for body %j',
    async (body) => {
      const res = await POST(makeRequest(body))
      expect(res.status).toBe(400)
      expect(mockAccept).not.toHaveBeenCalled()
    },
  )

  it('accepts the trimmed token and returns the membership', async () => {
    const membership = { id: 'm1', company_name: 'Acme', role: 'admin' }
    mockAccept.mockResolvedValue(membership)
    const res = await POST(makeRequest({ token: '  tok  ' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(membership)
    expect(mockAccept).toHaveBeenCalledWith({ token: 'tok' })
  })

  it('explains a 404', async () => {
    mockAccept.mockRejectedValue(new NotFoundError('not found'))
    const res = await POST(makeRequest({ token: 'tok' }))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toMatch(/addressed to your email/)
  })

  it('explains a 409', async () => {
    mockAccept.mockRejectedValue(new LedewireError('conflict', 409))
    const res = await POST(makeRequest({ token: 'tok' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already belong/)
  })

  it('explains a 410', async () => {
    mockAccept.mockRejectedValue(new LedewireError('gone', 410))
    const res = await POST(makeRequest({ token: 'tok' }))
    expect(res.status).toBe(410)
    expect((await res.json()).error).toMatch(/expired or was withdrawn/)
  })

  it('returns 401 on AuthError', async () => {
    mockAccept.mockRejectedValue(new AuthError('expired'))
    expect((await POST(makeRequest({ token: 'tok' }))).status).toBe(401)
  })
})
