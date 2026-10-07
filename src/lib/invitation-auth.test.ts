import { describe, it, expect, vi } from 'vitest'
import { LedewireError } from '@ledewire/node'
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
  function clientWith(get: () => Promise<unknown>) {
    return { company: { membership: { get } } } as never
  }

  it('lands an admin on the members page and a member on the wallet', async () => {
    expect(await joinedCompanyLanding(clientWith(async () => ({ role: 'admin' })))).toBe(
      '/company/members',
    )
    expect(await joinedCompanyLanding(clientWith(async () => ({ role: 'member' })))).toBe('/wallet')
  })

  it('falls back to the default landing when the lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing = clientWith(async () => {
      throw new LedewireError('Server error', 500)
    })
    expect(await joinedCompanyLanding(failing)).toBeUndefined()
  })
})
