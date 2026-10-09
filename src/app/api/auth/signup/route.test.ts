import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSignup = vi.fn()
const mockMembershipGet = vi.fn()
const mockInvitationAccept = vi.fn()

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))
vi.mock('@/lib/config', () => ({ config: { ledewireBaseUrl: 'https://api.ledewire.com' } }))
vi.mock('@ledewire/node', async () => {
  const actual = await vi.importActual<typeof import('@ledewire/node')>('@ledewire/node')
  return { ...actual, createClient: vi.fn() }
})

import { POST } from './route'
import { LedewireError, NotFoundError, createClient } from '@ledewire/node'
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
    vi.mocked(createClient).mockReturnValue({
      auth: { signup: mockSignup },
      company: {
        membership: { get: mockMembershipGet },
        invitations: { accept: mockInvitationAccept },
      },
    } as never)
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

  describe('with invitation tokens', () => {
    const fields = { name: 'Alice', email: 'a@b.com', password: 'secret123' }
    const authRes = {
      access_token: 'tok_a',
      refresh_token: 'tok_r',
      expires_at: '2026-12-31T00:00:00Z',
    }

    it('forwards company_invitation_token and invitation_token to signup', async () => {
      mockSignup.mockResolvedValue(authRes)
      mockMembershipGet.mockResolvedValue({ role: 'member' })
      await POST(makeRequest({ ...fields, company_invitation_token: 'T', invitation_token: 'S' }))
      expect(mockSignup).toHaveBeenCalledWith({
        ...fields,
        company_invitation_token: 'T',
        invitation_token: 'S',
      })
    })

    it('forwards a store invitation_token alone and lands on the dashboard', async () => {
      mockSignup.mockResolvedValue(authRes)
      const res = await POST(makeRequest({ ...fields, invitation_token: 'S' }))
      expect(mockSignup).toHaveBeenCalledWith({ ...fields, invitation_token: 'S' })
      expect(await res.json()).toEqual({ ok: true })
      expect(mockMembershipGet).not.toHaveBeenCalled()
      expect(mockInvitationAccept).not.toHaveBeenCalled()
    })

    it.each([
      ['admin', '/company/members'],
      ['member', '/wallet'],
    ])('sends a new Company %s to %s', async (role, redirect) => {
      mockSignup.mockResolvedValue(authRes)
      mockMembershipGet.mockResolvedValue({ role })
      const res = await POST(makeRequest({ ...fields, company_invitation_token: 'T' }))
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ ok: true, redirect })
    })

    it('still signs up, landing on the dashboard, when the membership lookup fails', async () => {
      mockSignup.mockResolvedValue(authRes)
      mockMembershipGet.mockRejectedValue(new LedewireError('Server error', 500))
      const res = await POST(makeRequest({ ...fields, company_invitation_token: 'T' }))
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ ok: true })
      expect(mockSession.accessToken).toBe('tok_a')
      expect(mockInvitationAccept).not.toHaveBeenCalled()
    })

    it('accepts the invitation itself when the signup left the buyer outside the Company', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockSignup.mockResolvedValue(authRes)
      mockMembershipGet.mockRejectedValue(new NotFoundError('No open membership'))
      mockInvitationAccept.mockResolvedValue({ role: 'member' })
      const res = await POST(makeRequest({ ...fields, company_invitation_token: 'T' }))
      expect(mockInvitationAccept).toHaveBeenCalledWith({ token: 'T' })
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ ok: true, redirect: '/wallet' })
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
    ])('returns 422 with a message for a refused invitation (%s)', async (reason, error) => {
      mockSignup.mockRejectedValue(
        new LedewireError('Invitation not accepted', 422, 422, 'invitation_not_accepted', {
          reason,
          invitation: 'company',
        }),
      )
      const res = await POST(makeRequest({ ...fields, company_invitation_token: 'T' }))
      expect(res.status).toBe(422)
      expect(await res.json()).toEqual({ error, type: 'invitation_not_accepted', reason })
      expect(mockSession.save).not.toHaveBeenCalled()
    })
  })

  it('returns 500 on unexpected error', async () => {
    mockSignup.mockRejectedValue(new Error('db failure'))
    const res = await POST(makeRequest({ name: 'Alice', email: 'a@b.com', password: 'secret123' }))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'An unexpected error occurred' })
  })
})
