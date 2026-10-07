import type { CompanyRole } from '@ledewire/node'

/**
 * The invitation tokens an invitation email carries on its signup link:
 * `company_invitation_token` (Company) and `invitation_token` (store).
 */
export interface InvitationTokens {
  company_invitation_token?: string
  invitation_token?: string
}

function token(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Picks the invitation tokens out of a query string or request body, dropping anything else. */
export function pickInvitationTokens(source: Record<string, unknown>): InvitationTokens {
  const tokens: InvitationTokens = {}
  const company = token(source.company_invitation_token)
  const store = token(source.invitation_token)
  if (company) tokens.company_invitation_token = company
  if (store) tokens.invitation_token = store
  return tokens
}

/** Carries the invitation tokens onto another auth page's link. */
export function withInvitationTokens(path: string, tokens: InvitationTokens): string {
  const query = new URLSearchParams()
  if (tokens.company_invitation_token)
    query.set('company_invitation_token', tokens.company_invitation_token)
  if (tokens.invitation_token) query.set('invitation_token', tokens.invitation_token)
  return query.size ? `${path}?${query}` : path
}

/**
 * Says why an invitation was refused, from the API's `reason`
 * (`InvitationRefusalReason`). Unknown reasons get a generic message.
 */
export function invitationRefusalMessage(
  reason: string | undefined,
  invitation: string | undefined = 'company',
): string {
  const sender = invitation === 'store' ? 'the store owner' : 'your Company admin'
  switch (reason) {
    case 'expired':
      return `This invitation has expired. Ask ${sender} to send a new one.`
    case 'already_accepted':
      return 'This invitation has already been used.'
    case 'wrong_email':
      return 'This invitation was sent to a different email address. Use the address it was sent to.'
    case 'already_in_company':
      return 'You already belong to a Company. Leave it before accepting this invitation.'
    case 'already_member':
      return 'You already belong to this store.'
    case 'not_found':
      return `This invitation isn't addressed to this email, or no longer exists. Ask ${sender} to send a new one.`
    default:
      return `This invitation couldn't be accepted. Ask ${sender} to send a new one.`
  }
}

/** Where a buyer lands after joining a Company. */
export function companyLanding(role: CompanyRole): string {
  return role === 'admin' ? '/company/members' : '/wallet'
}
