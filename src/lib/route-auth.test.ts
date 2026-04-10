import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockGetSession = vi.fn()
vi.mock('./session', () => ({ getSession: mockGetSession }))

describe('requireAuthForRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 NextResponse when no accessToken', async () => {
    mockGetSession.mockResolvedValue({ accessToken: undefined })
    const { requireAuthForRoute } = await import('./route-auth')
    const result = await requireAuthForRoute()
    expect(result).toBeInstanceOf(NextResponse)
    const res = result as NextResponse
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'Not authenticated' })
  })

  it('returns empty object when authenticated', async () => {
    mockGetSession.mockResolvedValue({ accessToken: 'tok_abc' })
    const { requireAuthForRoute } = await import('./route-auth')
    const result = await requireAuthForRoute()
    expect(result).toEqual({})
  })
})
