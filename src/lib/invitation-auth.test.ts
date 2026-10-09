import { describe, it, expect, vi } from 'vitest'
import { LedewireError, NotFoundError } from '@ledewire/node'
import { invitationRefusedResponse, joinedCompanyLanding } from './invitation-auth'

function refusal(details: Record<string, unknown>) {
  return new LedewireError('Invitation not accepted', 422, 422, 'invitation_not_accepted', details)
}

describe('invitationRefusedResponse', () => {
  it('maps a refused Company invitation to a 422 with its message', async () => {
    const res = invitationRefusedResponse(refusal({ reason: 'expired', invitation: 'company' }))
    expect(res?.status).toBe(422)
    expect(await res?.json()).toEqual({
      error: 'This invitation has expired. Ask your Company admin to send a new one.',
      type: 'invitation_not_accepted',
      reason: 'expired',
    })
  })

  it('names the store owner for a refused store invitation', async () => {
    const res = invitationRefusedResponse(refusal({ reason: 'expired', invitation: 'store' }))
    expect(await res?.json()).toMatchObject({
      error: 'This invitation has expired. Ask the store owner to send a new one.',
    })
  })

  it('falls back to a generic message without details', async () => {
    const res = invitationRefusedResponse(refusal({}))
    expect(await res?.json()).toMatchObject({
      error: "This invitation couldn't be accepted. Ask your Company admin to send a new one.",
    })
  })

  it('ignores any other error', () => {
    expect(invitationRefusedResponse(new LedewireError('Email taken', 409))).toBeNull()
    expect(invitationRefusedResponse(new Error('boom'))).toBeNull()
  })
})

describe('joinedCompanyLanding', () => {
  function clientWith(get: () => Promise<unknown>, accept = vi.fn()) {
    return { company: { membership: { get }, invitations: { accept } } } as never
  }
  const notInCompany = async () => {
    throw new NotFoundError('No open membership')
  }

  it('lands an admin on the members page and a member on the wallet', async () => {
    expect(
      await joinedCompanyLanding(
        clientWith(async () => ({ role: 'admin' })),
        'T',
      ),
    ).toBe('/company/members')
    expect(
      await joinedCompanyLanding(
        clientWith(async () => ({ role: 'member' })),
        'T',
      ),
    ).toBe('/wallet')
  })

  it('does not accept the invitation again when the buyer already joined', async () => {
    const accept = vi.fn()
    await joinedCompanyLanding(
      clientWith(async () => ({ role: 'member' }), accept),
      'T',
    )
    expect(accept).not.toHaveBeenCalled()
  })

  it('accepts the invitation itself when the sign-in left the buyer outside the Company', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const accept = vi.fn().mockResolvedValue({ role: 'admin' })
    expect(await joinedCompanyLanding(clientWith(notInCompany, accept), 'T')).toBe(
      '/company/members',
    )
    expect(accept).toHaveBeenCalledWith({ token: 'T' })
    expect(console.warn).toHaveBeenCalled()
  })

  it('lands on the dashboard notice when that accept is refused', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const accept = vi.fn().mockRejectedValue(refusal({ reason: 'expired' }))
    expect(await joinedCompanyLanding(clientWith(notInCompany, accept), 'T')).toBe(
      '/dashboard?invitation_refused=expired',
    )
  })

  it('falls back to the default landing when that accept fails otherwise', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const accept = vi.fn().mockRejectedValue(new LedewireError('Server error', 500))
    expect(await joinedCompanyLanding(clientWith(notInCompany, accept), 'T')).toBeUndefined()
  })

  it('falls back to the default landing, without accepting, when the lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const accept = vi.fn()
    const failing = clientWith(async () => {
      throw new LedewireError('Server error', 500)
    }, accept)
    expect(await joinedCompanyLanding(failing, 'T')).toBeUndefined()
    expect(accept).not.toHaveBeenCalled()
  })
})
