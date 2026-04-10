import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockRevoke = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { DELETE } from './route'
import { AuthError, LedewireError, NotFoundError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

const params = { params: Promise.resolve({ id: 'key-123' }) }

describe('DELETE /api/api-keys/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      user: { apiKeys: { revoke: mockRevoke } },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await DELETE(new Request('http://localhost'), params)
    expect(res.status).toBe(401)
  })

  it('revokes the key and returns 200', async () => {
    mockRevoke.mockResolvedValue(undefined)
    const res = await DELETE(new Request('http://localhost'), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockRevoke).toHaveBeenCalledWith('key-123')
  })

  it('returns 404 on NotFoundError', async () => {
    mockRevoke.mockRejectedValue(new NotFoundError('key not found'))
    const res = await DELETE(new Request('http://localhost'), params)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'Key not found' })
  })

  it('returns 401 on AuthError', async () => {
    mockRevoke.mockRejectedValue(new AuthError('expired'))
    const res = await DELETE(new Request('http://localhost'), params)
    expect(res.status).toBe(401)
  })

  it('returns status from LedewireError', async () => {
    mockRevoke.mockRejectedValue(new LedewireError('rate limited', 429))
    const res = await DELETE(new Request('http://localhost'), params)
    expect(res.status).toBe(429)
  })

  it('returns 500 on unexpected error', async () => {
    mockRevoke.mockRejectedValue(new Error('boom'))
    const res = await DELETE(new Request('http://localhost'), params)
    expect(res.status).toBe(500)
  })
})
