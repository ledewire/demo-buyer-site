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

const PUBLIC_KEY = 'A'.repeat(43)
const PROOF = 'B'.repeat(86)
const VALID = { name: 'research-agent', public_key: PUBLIC_KEY, proof: PROOF }

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/payment-keys', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

const unauthenticated = () =>
  vi
    .mocked(requireAuthForRoute)
    .mockResolvedValue(NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuthForRoute).mockResolvedValue({})
  vi.mocked(createBuyerClient).mockResolvedValue({
    user: { paymentKeys: { list: mockList, create: mockCreate } },
  } as never)
})

describe('GET /api/payment-keys', () => {
  it("returns the Buyer's active Payment keys", async () => {
    const keys = [{ id: 'pk-1', name: 'research-agent' }]
    mockList.mockResolvedValue(keys)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(keys)
  })

  it('returns 401 when not authenticated', async () => {
    unauthenticated()
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mockList).not.toHaveBeenCalled()
  })

  it("passes the API's refusal through", async () => {
    mockList.mockRejectedValue(new ForbiddenError('Invalid Role'))
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 401 when the API rejects the session', async () => {
    mockList.mockRejectedValue(new AuthError('expired'))
    expect((await GET()).status).toBe(401)
  })

  it('returns 500 on an unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockList.mockRejectedValue(new Error('boom'))
    expect((await GET()).status).toBe(500)
  })
})

describe('POST /api/payment-keys', () => {
  it('registers the key with exactly { name, public_key, proof }, dropping anything else', async () => {
    const created = { id: 'pk-1', ...VALID, created_by_user_id: null }
    mockCreate.mockResolvedValue(created)
    const res = await post({ ...VALID, private_key: 'never-send-me', secret: 'x' })
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate.mock.calls[0][0]).toStrictEqual(VALID)
    expect(await res.json()).toEqual(created)
  })

  it('trims surrounding whitespace a paste may carry', async () => {
    mockCreate.mockResolvedValue({ id: 'pk-1' })
    await post({ name: ' research-agent ', public_key: `${PUBLIC_KEY}\n`, proof: ` ${PROOF} ` })
    expect(mockCreate.mock.calls[0][0]).toStrictEqual(VALID)
  })

  it('returns 401 when not authenticated', async () => {
    unauthenticated()
    const res = await post(VALID)
    expect(res.status).toBe(401)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const res = await post('not json')
    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['a null body', null],
    ['a missing name', { public_key: PUBLIC_KEY, proof: PROOF }],
    ['a blank public_key', { ...VALID, public_key: '  ' }],
    ['a non-string proof', { ...VALID, proof: 42 }],
  ])('returns 400 naming the field for %s', async (_label, body) => {
    const res = await post(body)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/is required/)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['an invalid proof (422)', 422, 'Proof does not verify'],
    ['a blank field (400)', 400, "Name can't be blank"],
  ])("passes %s through with the API's message", async (_label, status, message) => {
    mockCreate.mockRejectedValue(new LedewireError(message, status))
    const res = await post(VALID)
    expect(res.status).toBe(status)
    expect((await res.json()).error).toBe(message)
  })

  it('returns 401 when the API rejects the session', async () => {
    mockCreate.mockRejectedValue(new AuthError('expired'))
    const res = await post(VALID)
    expect(res.status).toBe(401)
  })

  it('returns 500 on an unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreate.mockRejectedValue(new Error('boom'))
    expect((await post(VALID)).status).toBe(500)
  })
})
