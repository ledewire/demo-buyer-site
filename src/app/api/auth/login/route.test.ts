import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockLoginWithEmail = vi.fn()

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
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.accessToken = undefined
    mockSession.refreshToken = undefined
    mockSession.expiresAt = undefined
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(createClient).mockReturnValue({
      auth: { loginWithEmail: mockLoginWithEmail },
    } as never)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid JSON body' })
  })

  it('returns 400 when email or password is missing', async () => {
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('required') })
  })

  it('saves session and returns 200 on successful login', async () => {
    mockLoginWithEmail.mockResolvedValue({
      access_token: 'tok_a',
      refresh_token: 'tok_r',
      expires_at: '2026-12-31T00:00:00Z',
    })
    const res = await POST(makeRequest({ email: 'user@example.com', password: 'pass' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockSession.accessToken).toBe('tok_a')
    expect(mockSession.save).toHaveBeenCalled()
  })

  it('returns 401 on AuthError', async () => {
    mockLoginWithEmail.mockRejectedValue(new AuthError('bad credentials'))
    const res = await POST(makeRequest({ email: 'user@example.com', password: 'wrong' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'Invalid email or password' })
  })

  it('returns status from LedewireError', async () => {
    mockLoginWithEmail.mockRejectedValue(new LedewireError('rate limited', 429))
    const res = await POST(makeRequest({ email: 'user@example.com', password: 'pass' }))
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ error: 'rate limited' })
  })

  it('returns 500 on unexpected error', async () => {
    mockLoginWithEmail.mockRejectedValue(new Error('boom'))
    const res = await POST(makeRequest({ email: 'user@example.com', password: 'pass' }))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'An unexpected error occurred' })
  })
})
