import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockCreate = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))

import { POST } from './route'
import { AuthError, LedewireError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/exports', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

describe('POST /api/exports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      acquisitions: { create: mockCreate },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await post({ urls: ['https://a.example/1'] })
    expect(res.status).toBe(401)
  })

  it('creates an acquisition and returns 201', async () => {
    mockCreate.mockResolvedValue({ id: 'acq-1', status: 'quoted' })
    const res = await post({ urls: ['https://a.example/1', 'http://b.example/2'] })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'acq-1', status: 'quoted' })
    expect(mockCreate).toHaveBeenCalledWith({
      urls: ['https://a.example/1', 'http://b.example/2'],
    })
  })

  it('rejects invalid JSON', async () => {
    const res = await post('{nope')
    expect(res.status).toBe(400)
  })

  it.each([
    ['missing urls', {}],
    ['empty urls', { urls: [] }],
    ['non-array urls', { urls: 'https://a.example' }],
    ['non-http url', { urls: ['javascript:alert(1)'] }],
    ['non-string url', { urls: [42] }],
    ['too many urls', { urls: Array(10_001).fill('https://a.example/1') }],
  ])('rejects %s', async (_label, body) => {
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 401 on AuthError', async () => {
    mockCreate.mockRejectedValue(new AuthError('expired'))
    const res = await post({ urls: ['https://a.example/1'] })
    expect(res.status).toBe(401)
  })

  it('returns status and type from LedewireError', async () => {
    mockCreate.mockRejectedValue(new LedewireError('bad', 422, undefined, 'validation_error'))
    const res = await post({ urls: ['https://a.example/1'] })
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'bad', type: 'validation_error' })
  })

  it('returns 500 on unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreate.mockRejectedValue(new Error('boom'))
    const res = await post({ urls: ['https://a.example/1'] })
    expect(res.status).toBe(500)
  })
})
