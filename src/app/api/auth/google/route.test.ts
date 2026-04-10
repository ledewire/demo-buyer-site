import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockLoginWithGoogle = vi.fn()

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))
vi.mock('@/lib/config', () => ({ config: { ledewireBaseUrl: 'https://api.ledewire.com' } }))
vi.mock('@ledewire/node', async () => {
  const actual = await vi.importActual<typeof import('@ledewire/node')>('@ledewire/node')
  return { ...actual, createClient: vi.fn() }
})

import { POST } from './route'
import { AuthError, LedewireError, createClient } from '@ledewire/node'
import { getSession } from '@/lib/session'

const mockSession = {
  accessToken: undefined as string | undefined,
  refreshToken: undefined as string | undefined,
  expiresAt: undefined as number | undefined,
  save: vi.fn(),
}

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/google', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.accessToken = undefined
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(createClient).mockReturnValue({
      auth: { loginWithGoogle: mockLoginWithGoogle },
    } as never)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/google', { method: 'POST', body: 'bad' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when id_token is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'id_token is required' })
  })

  it('saves session and returns 200 on success', async () => {
    mockLoginWithGoogle.mockResolvedValue({
      access_token: 'tok_a',
      refresh_token: 'tok_r',
      expires_at: '2026-12-31T00:00:00Z',
    })
    const res = await POST(makeRequest({ id_token: 'google_token' }))
    expect(res.status).toBe(200)
    expect(mockSession.accessToken).toBe('tok_a')
    expect(mockSession.save).toHaveBeenCalled()
  })

  it('returns 401 on AuthError', async () => {
    mockLoginWithGoogle.mockRejectedValue(new AuthError('invalid google token'))
    const res = await POST(makeRequest({ id_token: 'bad_token' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'Google sign-in failed' })
  })

  it('returns status from LedewireError', async () => {
    mockLoginWithGoogle.mockRejectedValue(new LedewireError('service unavailable', 503))
    const res = await POST(makeRequest({ id_token: 'tok' }))
    expect(res.status).toBe(503)
  })

  it('returns 500 on unexpected error', async () => {
    mockLoginWithGoogle.mockRejectedValue(new Error('boom'))
    const res = await POST(makeRequest({ id_token: 'tok' }))
    expect(res.status).toBe(500)
  })
})
