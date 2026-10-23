import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockPurchasesList = vi.fn()
const mockPurchasesCreate = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { GET, POST } from './route'
import { AuthError, LedewireError, SpendCapReachedError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

describe('GET /api/purchases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      purchases: { list: mockPurchasesList },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns list of purchases', async () => {
    const purchases = [{ id: 'p1', content_id: 'c1' }]
    mockPurchasesList.mockResolvedValue(purchases)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(purchases)
  })

  it('unwraps a paginated envelope', async () => {
    const purchases = [{ id: 'p1', content_id: 'c1' }]
    mockPurchasesList.mockResolvedValue({ data: purchases, pagination: { total: 1 } })
    const res = await GET()
    expect(await res.json()).toEqual(purchases)
  })

  it('returns 401 on AuthError', async () => {
    mockPurchasesList.mockRejectedValue(new AuthError('expired'))
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns status from LedewireError', async () => {
    mockPurchasesList.mockRejectedValue(new LedewireError('forbidden', 403))
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns 500 on unexpected error', async () => {
    mockPurchasesList.mockRejectedValue(new Error('boom'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

function postPurchase(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/purchases', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

function makePurchase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    content_id: 'c-1',
    content: {
      id: 'c-1',
      content_type: 'markdown',
      title: 'Ocean heat',
      resource_url: null,
      publication: null,
    },
    buyer: { id: 'b-1', name: 'Buyer' },
    seller: { id: 's-1', name: 'Seller' },
    amount_cents: 125,
    timestamp: '2026-10-23T00:00:00Z',
    status: 'completed',
    ...overrides,
  }
}

describe('POST /api/purchases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      purchases: { create: mockPurchasesCreate },
    } as never)
  })

  it('returns 401 when not authenticated, without buying', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await postPurchase({ content_id: 'c-1' })
    expect(res.status).toBe(401)
    expect(mockPurchasesCreate).not.toHaveBeenCalled()
  })

  it('buys by content_id and returns the markdown body as delivered, not base64-decoded', async () => {
    // "IyBIaQ==" is valid base64 ("# Hi"); a route that decoded it would change it.
    const body = '# Ocean heat\n\nIyBIaQ=='
    mockPurchasesCreate.mockResolvedValue(makePurchase({ content_body: body }))
    const res = await postPurchase({ content_id: 'c-1' })
    expect(res.status).toBe(200)
    expect(mockPurchasesCreate).toHaveBeenCalledWith({ content_id: 'c-1' })
    expect(await res.json()).toEqual({ content_type: 'markdown', content_body: body })
  })

  it('sanitizes an HTML body, dropping <script> and onerror=', async () => {
    mockPurchasesCreate.mockResolvedValue(
      makePurchase({
        content: { ...makePurchase().content, content_type: 'html' },
        content_body:
          '<p>Warm <b>seas</b></p><script>alert(1)</script><img src="x.png" onerror="alert(2)">' +
          '<a href="https://example.com" target="_blank">More</a>',
      }),
    )
    const res = await postPurchase({ content_id: 'c-1' })
    const data = await res.json()
    expect(data.content_type).toBe('html')
    expect(data.content_body).toContain('<p>Warm <b>seas</b></p>')
    expect(data.content_body).not.toContain('<script')
    expect(data.content_body).not.toContain('alert(1)')
    expect(data.content_body).not.toContain('onerror')
    expect(data.content_body).toContain('<img src="x.png" />')
    expect(data.content_body).toContain('rel="noopener noreferrer"')
  })

  it('returns content_uri for a work hosted elsewhere', async () => {
    mockPurchasesCreate.mockResolvedValue(
      makePurchase({
        content: { ...makePurchase().content, content_type: 'pdf' },
        content_uri: 'https://cdn.example.com/ocean.pdf',
      }),
    )
    const res = await postPurchase({ content_id: 'c-1' })
    expect(await res.json()).toEqual({
      content_type: 'pdf',
      content_uri: 'https://cdn.example.com/ocean.pdf',
    })
  })

  it('drops a content_uri that is not http or https', async () => {
    mockPurchasesCreate.mockResolvedValue(
      makePurchase({
        content: { ...makePurchase().content, content_type: 'pdf' },
        content_uri: 'javascript:alert(1)',
      }),
    )
    const res = await postPurchase({ content_id: 'c-1' })
    expect(await res.json()).toEqual({ content_type: 'pdf' })
  })

  it.each([
    ['no content_id', {}],
    ['an empty content_id', { content_id: '' }],
    ['a non-string content_id', { content_id: 7 }],
    ['a body that is not JSON', 'not json'],
  ])('returns 400 for %s, without buying', async (_label, body) => {
    const res = await postPurchase(body)
    expect(res.status).toBe(400)
    expect(mockPurchasesCreate).not.toHaveBeenCalled()
  })

  it('returns 402 for a spend-cap refusal', async () => {
    mockPurchasesCreate.mockRejectedValue(
      Object.assign(Object.create(SpendCapReachedError.prototype), {
        message: 'Daily spend cap reached',
        statusCode: 402,
        resetsAt: '2026-10-24T00:00:00Z',
      }),
    )
    const res = await postPurchase({ content_id: 'c-1' })
    expect(res.status).toBe(402)
    expect(await res.json()).toEqual({
      error: 'Daily spend cap reached',
      type: 'daily_spend_cap_reached',
      resets_at: '2026-10-24T00:00:00Z',
    })
  })

  it('passes on an insufficient-funds refusal with its type', async () => {
    mockPurchasesCreate.mockRejectedValue(
      new LedewireError('Insufficient funds', 422, undefined, 'insufficient_funds' as never),
    )
    const res = await postPurchase({ content_id: 'c-1' })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'Insufficient funds', type: 'insufficient_funds' })
  })

  it('returns 401 on AuthError', async () => {
    mockPurchasesCreate.mockRejectedValue(new AuthError('expired'))
    const res = await postPurchase({ content_id: 'c-1' })
    expect(res.status).toBe(401)
  })

  it('returns 500 on an unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockPurchasesCreate.mockRejectedValue(new Error('boom'))
    const res = await postPurchase({ content_id: 'c-1' })
    expect(res.status).toBe(500)
  })
})
