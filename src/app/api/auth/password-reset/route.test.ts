import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/config', () => ({ config: { ledewireBaseUrl: 'https://api.ledewire.com' } }))

const mockRequestReset = vi.fn()
const mockResetPassword = vi.fn()
vi.mock('@ledewire/node', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ledewire/node')>()
  return {
    ...actual,
    createClient: vi.fn(() => ({
      auth: {
        requestPasswordReset: mockRequestReset,
        resetPassword: mockResetPassword,
      },
    })),
  }
})

import { POST } from './route'
import { LedewireError } from '@ledewire/node'

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/auth/password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/password-reset', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/auth/password-reset', {
      method: 'POST',
      body: 'bad',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when action or email is missing', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('required') })
  })

  it('requests a password reset and returns 200', async () => {
    mockRequestReset.mockResolvedValue(undefined)
    const res = await POST(makeRequest({ action: 'request', email: 'a@b.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockRequestReset).toHaveBeenCalledWith({ email: 'a@b.com' })
  })

  it('returns 400 when confirm is missing reset_code or password', async () => {
    const res = await POST(makeRequest({ action: 'confirm', email: 'a@b.com' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('required') })
  })

  it('confirms password reset and returns 200', async () => {
    mockResetPassword.mockResolvedValue(undefined)
    const res = await POST(
      makeRequest({ action: 'confirm', email: 'a@b.com', reset_code: 'ABC', password: 'newpass' }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockResetPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      reset_code: 'ABC',
      password: 'newpass',
    })
  })

  it('returns 400 for unknown action', async () => {
    const res = await POST(makeRequest({ action: 'unknown', email: 'a@b.com' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid action' })
  })

  it('returns status from LedewireError', async () => {
    mockRequestReset.mockRejectedValue(new LedewireError('not found', 404))
    const res = await POST(makeRequest({ action: 'request', email: 'a@b.com' }))
    expect(res.status).toBe(404)
  })

  it('returns 500 on unexpected error', async () => {
    mockRequestReset.mockRejectedValue(new Error('boom'))
    const res = await POST(makeRequest({ action: 'request', email: 'a@b.com' }))
    expect(res.status).toBe(500)
  })
})
