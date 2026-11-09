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

const VALID = { name: 'crawler', public_key: 'A'.repeat(43), proof: 'B'.repeat(86) }

function post(body: unknown, id = 'mu-1') {
  return POST(
    new NextRequest(`http://localhost/api/company/machine-users/${id}/payment-keys`, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id }) },
  )
}

describe('POST /api/company/machine-users/:id/payment-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      company: { machineUsers: { paymentKeys: { create: mockCreate } } },
    } as never)
  })

  it("registers the Machine user's key with exactly { name, public_key, proof }", async () => {
    const created = { id: 'pk-1', ...VALID, created_by_user_id: 'admin-1' }
    mockCreate.mockResolvedValue(created)
    const res = await post({ ...VALID, private_key: 'never-send-me' })
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate.mock.calls[0][0]).toBe('mu-1')
    expect(mockCreate.mock.calls[0][1]).toStrictEqual(VALID)
    expect(await res.json()).toEqual(created)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await post(VALID)
    expect(res.status).toBe(401)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON or a blank field', async () => {
    expect((await post('not json')).status).toBe(400)
    const res = await post({ ...VALID, name: '' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('name is required')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['a deactivated Machine user', 409],
    ['the 10-key limit', 422],
  ])("passes %s through with the API's message", async (_label, status) => {
    mockCreate.mockRejectedValue(new LedewireError('refused', status))
    const res = await post(VALID)
    expect(res.status).toBe(status)
    expect((await res.json()).error).toBe('refused')
  })

  it('returns 404 when the Machine user is not in the Company', async () => {
    mockCreate.mockRejectedValue(new NotFoundError('not found'))
    expect((await post(VALID, 'mu-gone')).status).toBe(404)
  })
})
