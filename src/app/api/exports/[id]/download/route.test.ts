import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockDownload = vi.fn()
const mockGetCorpus = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))

import { GET } from './route'
import { AuthError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

const call = (id = 'acq-1') =>
  GET(new Request('http://localhost'), { params: Promise.resolve({ id }) })

function readyResult(body: string, headers: Record<string, string> = {}) {
  const response = new Response(new TextEncoder().encode(body), { headers })
  return { ready: true, body: response.body, response }
}

describe('GET /api/exports/[id]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      acquisitions: { downloadCorpus: mockDownload, getCorpus: mockGetCorpus },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    expect((await call()).status).toBe(401)
  })

  it('streams the archive with a filename from the corpus format', async () => {
    mockDownload.mockResolvedValue(readyResult('archive-bytes'))
    mockGetCorpus.mockResolvedValue({ state: 'ready', format: 'jsonl_gz' })
    const res = await call()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/gzip')
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="export-acq-1.jsonl.gz"',
    )
    expect(await res.text()).toBe('archive-bytes')
  })

  it('falls back to upstream headers when the format is unknown', async () => {
    mockDownload.mockResolvedValue(
      readyResult('x', {
        'content-type': 'application/x-tar',
        'content-disposition': 'attachment; filename="upstream.tar.gz"',
      }),
    )
    mockGetCorpus.mockRejectedValue(new Error('flaky'))
    const res = await call()
    expect(res.headers.get('content-type')).toBe('application/x-tar')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="upstream.tar.gz"')
  })

  it('strips unsafe characters from the filename', async () => {
    mockDownload.mockResolvedValue(readyResult('x'))
    mockGetCorpus.mockResolvedValue({ state: 'ready', format: 'tar_gz' })
    const res = await call('a"b\r\nc')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="export-abc.tar.gz"')
  })

  it('returns 409 with corpus state when not ready', async () => {
    mockDownload.mockResolvedValue({ ready: false, corpus: { state: 'assembling' } })
    const res = await call()
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ corpus: { state: 'assembling' } })
  })

  it('returns 401 on AuthError', async () => {
    mockDownload.mockRejectedValue(new AuthError('expired'))
    expect((await call()).status).toBe(401)
  })
})
