import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockCreate = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { POST } from './route'
import { LedewireError, NotFoundError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/company/machine-users/mu-1/buyer-keys', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function post(body: unknown, id = 'mu-1') {
  return POST(postRequest(body), { params: Promise.resolve({ id }) })
}

describe('POST /api/company/machine-users/:id/buyer-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      company: { machineUsers: { buyerKeys: { create: mockCreate } } },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await post({ name: 'production' })
    expect(res.status).toBe(401)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const res = await post('not json')
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['a missing name', {}],
    ['a non-string name', { name: 42 }],
    ['a blank name', { name: '   ' }],
    ['a null body', null],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await post(body)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toEqual(expect.any(String))
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('issues a key for the machine user and returns its secret once, uncached', async () => {
    const created = { id: 'bk-1', name: 'production', key: 'bktst_abc', secret: 'f00d' }
    mockCreate.mockResolvedValue(created)
    const res = await post({ name: '  production  ' })
    expect(res.status).toBe(201)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(mockCreate).toHaveBeenCalledWith('mu-1', { name: 'production' })
    expect(await res.json()).toEqual(created)
  })

  it.each([
    ['a deactivated machine user', 409],
    ['a duplicate name', 422],
  ])('passes %s through with its status and message', async (_label, status) => {
    mockCreate.mockRejectedValue(new LedewireError('refused', status))
    const res = await post({ name: 'production' })
    expect(res.status).toBe(status)
    expect((await res.json()).error).toBe('refused')
  })

  it('returns 404 when the machine user is not in the Company', async () => {
    mockCreate.mockRejectedValue(new NotFoundError('not found'))
    const res = await post({ name: 'production' }, 'mu-gone')
    expect(res.status).toBe(404)
  })

  it('returns 500 on an unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreate.mockRejectedValue(new Error('boom'))
    const res = await post({ name: 'production' })
    expect(res.status).toBe(500)
  })
})
