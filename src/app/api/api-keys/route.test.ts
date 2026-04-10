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
import { AuthError, LedewireError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

function makePostRequest(body: object) {
  return new NextRequest('http://localhost/api/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      user: { apiKeys: { list: mockList, create: mockCreate } },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns list of api keys', async () => {
    const keys = [{ id: 'k1', name: 'My Key' }]
    mockList.mockResolvedValue(keys)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(keys)
  })

  it('returns 401 on AuthError', async () => {
    mockList.mockRejectedValue(new AuthError('expired'))
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns status from LedewireError', async () => {
    mockList.mockRejectedValue(new LedewireError('rate limited', 429))
    const res = await GET()
    expect(res.status).toBe(429)
  })

  it('returns 500 on unexpected error', async () => {
    mockList.mockRejectedValue(new Error('boom'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      user: { apiKeys: { list: mockList, create: mockCreate } },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await POST(makePostRequest({ name: 'Agent' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/api-keys', { method: 'POST', body: 'bad' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makePostRequest({ spending_limit_cents: 1000 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'name is required' })
  })

  it('creates a key and returns 201', async () => {
    const newKey = { id: 'k2', name: 'Agent', key: 'bktst_xyz' }
    mockCreate.mockResolvedValue(newKey)
    const res = await POST(makePostRequest({ name: 'Agent', spending_limit_cents: 500 }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(newKey)
  })

  it('returns 401 on AuthError', async () => {
    mockCreate.mockRejectedValue(new AuthError('expired'))
    const res = await POST(makePostRequest({ name: 'Agent' }))
    expect(res.status).toBe(401)
  })

  it('returns status from LedewireError', async () => {
    mockCreate.mockRejectedValue(new LedewireError('conflict', 409))
    const res = await POST(makePostRequest({ name: 'Agent' }))
    expect(res.status).toBe(409)
  })

  it('returns 500 on unexpected error', async () => {
    mockCreate.mockRejectedValue(new Error('boom'))
    const res = await POST(makePostRequest({ name: 'Agent' }))
    expect(res.status).toBe(500)
  })
})
