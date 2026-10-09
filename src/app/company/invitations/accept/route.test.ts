import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))

import { GET } from './route'
import { getSession } from '@/lib/session'

function visit(query: string) {
  return GET(new NextRequest(`http://localhost/company/invitations/accept${query}`))
}

function redirectedTo(res: Response): string {
  const location = new URL(res.headers.get('location') ?? '')
  return `${location.pathname}${location.search}`
}

describe('GET /company/invitations/accept', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({ accessToken: undefined } as never)
  })

  describe('signed out', () => {
    it('carries the token to sign-in', async () => {
      const res = await visit('?token=T')
      expect(res.status).toBe(307)
      expect(redirectedTo(res)).toBe('/login?company_invitation_token=T')
    })

    it.each(['', '?token=', '?token=%20%20'])('sends %j to plain sign-in', async (query) => {
      expect(redirectedTo(await visit(query))).toBe('/login')
    })
  })

  describe('signed in', () => {
    beforeEach(() => {
      vi.mocked(getSession).mockResolvedValue({ accessToken: 'tok_a' } as never)
    })

    it('hands the token to the join page', async () => {
      const res = await visit('?token=T')
      expect(res.status).toBe(307)
      expect(redirectedTo(res)).toBe('/join?token=T')
    })

    it.each(['', '?token=', '?token=%20%20'])('sends %j to the plain join page', async (query) => {
      expect(redirectedTo(await visit(query))).toBe('/join')
    })
  })

  it('keeps a token with reserved characters intact', async () => {
    const signedOut = new URL((await visit('?token=a%26b%3Dc')).headers.get('location') ?? '')
    expect(signedOut.searchParams.get('company_invitation_token')).toBe('a&b=c')

    vi.mocked(getSession).mockResolvedValue({ accessToken: 'tok_a' } as never)
    const signedIn = new URL((await visit('?token=a%26b%3Dc')).headers.get('location') ?? '')
    expect(signedIn.searchParams.get('token')).toBe('a&b=c')
  })
})
