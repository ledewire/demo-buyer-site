import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSignup = vi.fn()

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))
vi.mock('@/lib/config', () => ({ config: { ledewireBaseUrl: 'https://api.ledewire.com' } }))
vi.mock('@ledewire/node', async () => {
  const actual = await vi.importActual<typeof import('@ledewire/node')>('@ledewire/node')
  return { ...actual, createClient: vi.fn() }
})

import { POST } from './route'
import { LedewireError, createClient } from '@ledewire/node'
import { getSession } from '@/lib/session'

const mockSession = {
  accessToken: undefined as string | undefined,
  refreshToken: undefined as string | undefined,
  expiresAt: undefined as number | undefined,
  save: vi.fn(),
}

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.accessToken = undefined
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    vi.mocked(createClient).mockReturnValue({ auth: { signup: mockSignup } } as never)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: 'bad',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'secret123' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('required') })
  })

  it('saves session and returns 201 on success', async () => {
    mockSignup.mockResolvedValue({
      access_token: 'tok_a',
      refresh_token: 'tok_r',
      expires_at: '2026-12-31T00:00:00Z',
    })
    const res = await POST(makeRequest({ name: 'Alice', email: 'a@b.com', password: 'secret123' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockSession.accessToken).toBe('tok_a')
    expect(mockSession.save).toHaveBeenCalled()
  })

  it('returns status from LedewireError (e.g. 409 conflict)', async () => {
    mockSignup.mockRejectedValue(new LedewireError('Email already taken', 409))
    const res = await POST(makeRequest({ name: 'Alice', email: 'a@b.com', password: 'secret123' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'Email already taken' })
  })

  it('returns 500 on unexpected error', async () => {
    mockSignup.mockRejectedValue(new Error('db failure'))
    const res = await POST(makeRequest({ name: 'Alice', email: 'a@b.com', password: 'secret123' }))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'An unexpected error occurred' })
  })
})
