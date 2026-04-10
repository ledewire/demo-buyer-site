import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

const mockGetSession = vi.fn()
vi.mock('./session', () => ({ getSession: mockGetSession }))

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /login when no accessToken', async () => {
    mockGetSession.mockResolvedValue({ accessToken: undefined })
    const { requireAuth } = await import('./auth')
    await requireAuth()
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('does not redirect when accessToken is present', async () => {
    mockGetSession.mockResolvedValue({ accessToken: 'tok_abc' })
    const { requireAuth } = await import('./auth')
    await requireAuth()
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
