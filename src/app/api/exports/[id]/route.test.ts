import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockGet = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))

import { GET } from './route'
import { NotFoundError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

const call = () =>
  GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'acq-1' }) })

describe('GET /api/exports/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({ acquisitions: { get: mockGet } } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    expect((await call()).status).toBe(401)
  })

  it('returns the acquisition', async () => {
    mockGet.mockResolvedValue({ id: 'acq-1', status: 'quoted' })
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'acq-1', status: 'quoted' })
    expect(mockGet).toHaveBeenCalledWith('acq-1')
  })

  it('returns 404 when the acquisition does not exist', async () => {
    mockGet.mockRejectedValue(new NotFoundError('missing'))
    expect((await call()).status).toBe(404)
  })
})
