import { describe, it, expect } from 'vitest'
import {
  companyLanding,
  invitationRefusalMessage,
  pickInvitationTokens,
  withInvitationTokens,
} from './invitations'

describe('pickInvitationTokens', () => {
  it('keeps both tokens when they are non-empty strings', () => {
    expect(
      pickInvitationTokens({ company_invitation_token: 'C', invitation_token: 'S', other: 'x' }),
    ).toEqual({ company_invitation_token: 'C', invitation_token: 'S' })
  })

  it('drops missing, empty and non-string tokens', () => {
    expect(
      pickInvitationTokens({ company_invitation_token: ['C'], invitation_token: '  ' }),
    ).toEqual({})
    expect(pickInvitationTokens({})).toEqual({})
  })
})

describe('withInvitationTokens', () => {
  it('returns the path unchanged with no tokens', () => {
    expect(withInvitationTokens('/login', {})).toBe('/login')
  })

  it('appends the tokens as query parameters', () => {
    expect(
      withInvitationTokens('/login', { company_invitation_token: 'a b', invitation_token: 'S' }),
    ).toBe('/login?company_invitation_token=a+b&invitation_token=S')
  })
})

describe('invitationRefusalMessage', () => {
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
    ['already_accepted', 'This invitation has already been used.'],
    ['already_member', 'You already belong to this store.'],
    [
      'not_found',
      "This invitation isn't addressed to this email, or no longer exists. Ask your Company admin to send a new one.",
    ],
  ])('explains %s', (reason, message) => {
    expect(invitationRefusalMessage(reason)).toBe(message)
  })

  it('names the store owner for a store invitation', () => {
    expect(invitationRefusalMessage('expired', 'store')).toBe(
      'This invitation has expired. Ask the store owner to send a new one.',
    )
  })

  it('falls back to a generic message for an unknown reason', () => {
    expect(invitationRefusalMessage('something_new')).toBe(
      "This invitation couldn't be accepted. Ask your Company admin to send a new one.",
    )
    expect(invitationRefusalMessage(undefined)).toBe(
      "This invitation couldn't be accepted. Ask your Company admin to send a new one.",
    )
  })
})

describe('companyLanding', () => {
  it('sends an admin to the members page and a member to the wallet', () => {
    expect(companyLanding('admin')).toBe('/company/members')
    expect(companyLanding('member')).toBe('/wallet')
  })
})
