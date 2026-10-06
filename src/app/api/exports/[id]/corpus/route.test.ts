import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockGetCorpus = vi.fn()
const mockBuildCorpus = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))

import { GET, POST } from './route'
import { LedewireError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

const ctx = { params: Promise.resolve({ id: 'acq-1' }) }
const req = () => new Request('http://localhost')

describe('/api/exports/[id]/corpus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      acquisitions: { getCorpus: mockGetCorpus, buildCorpus: mockBuildCorpus },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    expect((await GET(req(), ctx)).status).toBe(401)
    expect((await POST(req(), ctx)).status).toBe(401)
  })

  it('GET returns corpus state', async () => {
    mockGetCorpus.mockResolvedValue({ state: 'pending' })
    const res = await GET(req(), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ state: 'pending' })
  })

  it('POST returns 202 while assembling', async () => {
    mockBuildCorpus.mockResolvedValue({ state: 'assembling', poll_after_seconds: 5 })
    const res = await POST(req(), ctx)
    expect(res.status).toBe(202)
    expect(mockBuildCorpus).toHaveBeenCalledWith('acq-1')
  })

  it('POST returns 200 when already ready', async () => {
    mockBuildCorpus.mockResolvedValue({ state: 'ready' })
    expect((await POST(req(), ctx)).status).toBe(200)
  })

  it('POST surfaces API errors', async () => {
    mockBuildCorpus.mockRejectedValue(new LedewireError('not settled', 409))
    expect((await POST(req(), ctx)).status).toBe(409)
  })
})
