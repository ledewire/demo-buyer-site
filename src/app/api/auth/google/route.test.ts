import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockLoginWithGoogle = vi.fn()
const mockMembershipGet = vi.fn()

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
      company: { membership: { get: mockMembershipGet } },
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
    expect(await res.json()).toEqual({ ok: true })
    expect(mockLoginWithGoogle).toHaveBeenCalledWith({ id_token: 'google_token' })
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

  describe('with invitation tokens', () => {
    const authRes = {
      access_token: 'tok_a',
      refresh_token: 'tok_r',
      expires_at: '2026-12-31T00:00:00Z',
    }

    it('forwards company_invitation_token and invitation_token to loginWithGoogle', async () => {
      mockLoginWithGoogle.mockResolvedValue(authRes)
      mockMembershipGet.mockResolvedValue({ role: 'member' })
      await POST(
        makeRequest({ id_token: 'g', company_invitation_token: 'T', invitation_token: 'S' }),
      )
      expect(mockLoginWithGoogle).toHaveBeenCalledWith({
        id_token: 'g',
        company_invitation_token: 'T',
        invitation_token: 'S',
      })
    })

    it('sends a new account that joined as admin to /company/members', async () => {
      mockLoginWithGoogle.mockResolvedValue(authRes) // a new account reports no `invitations`
      mockMembershipGet.mockResolvedValue({ role: 'admin' })
      const res = await POST(makeRequest({ id_token: 'g', company_invitation_token: 'T' }))
      expect(await res.json()).toEqual({ ok: true, redirect: '/company/members' })
    })

    it('sends an existing account whose invitation was accepted to its Company page', async () => {
      mockLoginWithGoogle.mockResolvedValue({
        ...authRes,
        invitations: { company: { accepted: true } },
      })
      mockMembershipGet.mockResolvedValue({ role: 'member' })
      const res = await POST(makeRequest({ id_token: 'g', company_invitation_token: 'T' }))
      expect(await res.json()).toEqual({ ok: true, redirect: '/wallet' })
    })

    it('signs in an existing account whose invitation was refused and reports why', async () => {
      mockLoginWithGoogle.mockResolvedValue({
        ...authRes,
        invitations: {
          company: { accepted: false, reason: 'already_in_company', message: 'In a Company' },
        },
      })
      const res = await POST(makeRequest({ id_token: 'g', company_invitation_token: 'T' }))
      expect(res.status).toBe(200)
      expect(mockSession.accessToken).toBe('tok_a')
      expect(mockSession.save).toHaveBeenCalled()
      expect(await res.json()).toEqual({
        ok: true,
        redirect: '/dashboard?invitation_refused=already_in_company',
      })
      expect(mockMembershipGet).not.toHaveBeenCalled()
    })

    it.each([
      ['expired', 'This invitation has expired. Ask your Company admin to send a new one.'],
      [
        'wrong_email',
        'This invitation was sent to a different email address. Use the address it was sent to.',
      ],
      [
        'already_in_company',
        'You already belong to a Company. Leave it before accepting this invitation.',
      ],
    ])('returns 422 with a message when a new account is refused (%s)', async (reason, error) => {
      mockLoginWithGoogle.mockRejectedValue(
        new LedewireError('Invitation not accepted', 422, 422, 'invitation_not_accepted', {
          reason,
          invitation: 'company',
        }),
      )
      const res = await POST(makeRequest({ id_token: 'g', company_invitation_token: 'T' }))
      expect(res.status).toBe(422)
      expect(await res.json()).toEqual({ error, type: 'invitation_not_accepted', reason })
      expect(mockSession.save).not.toHaveBeenCalled()
    })
  })

  it('returns 500 on unexpected error', async () => {
    mockLoginWithGoogle.mockRejectedValue(new Error('boom'))
    const res = await POST(makeRequest({ id_token: 'tok' }))
    expect(res.status).toBe(500)
  })
})
