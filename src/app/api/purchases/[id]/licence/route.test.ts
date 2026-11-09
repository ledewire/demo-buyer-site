import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockLicenseDocument = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))

import { GET } from './route'
import { AuthError, ForbiddenError, NotFoundError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

const call = (id = 'p-1') =>
  GET(new Request('http://localhost'), { params: Promise.resolve({ id }) })

const doc = (text: string, contentType: string) => ({
  body: new TextEncoder().encode(text).buffer,
  contentType,
})

describe('GET /api/purchases/[id]/licence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      purchases: { licenseDocument: mockLicenseDocument },
    } as never)
  })

  it('returns 401 when there is no session', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    expect((await call()).status).toBe(401)
    expect(mockLicenseDocument).not.toHaveBeenCalled()
  })

  it('sends the document back as an attachment with the SDK content type', async () => {
    mockLicenseDocument.mockResolvedValue(doc('%PDF-1.7 terms', 'application/pdf'))
    const res = await call('p-1')
    expect(mockLicenseDocument).toHaveBeenCalledWith('p-1')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="licence-p-1.pdf"')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).toBe('%PDF-1.7 terms')
  })

  it('names a Markdown document .md', async () => {
    mockLicenseDocument.mockResolvedValue(doc('# Terms', 'text/markdown; charset=utf-8'))
    const res = await call('p-2')
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="licence-p-2.md"')
  })

  it.each(['..', '../wallet', 'a/b', 'a%2F..', 'a"b\r\nc'])(
    'returns 400 without calling the API for id %j',
    async (id) => {
      const res = await call(id)
      expect(res.status).toBe(400)
      expect(mockLicenseDocument).not.toHaveBeenCalled()
    },
  )

  it('returns 401 on AuthError', async () => {
    mockLicenseDocument.mockRejectedValue(new AuthError('expired'))
    expect((await call()).status).toBe(401)
  })

  it('returns 403 on ForbiddenError', async () => {
    mockLicenseDocument.mockRejectedValue(new ForbiddenError('not your purchase'))
    expect((await call()).status).toBe(403)
  })

  it('returns 404 on NotFoundError', async () => {
    mockLicenseDocument.mockRejectedValue(new NotFoundError('no licence document'))
    expect((await call()).status).toBe(404)
  })

  it('returns 500 on an unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockLicenseDocument.mockRejectedValue(new Error('boom'))
    const res = await call()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'An unexpected error occurred' })
  })
})
