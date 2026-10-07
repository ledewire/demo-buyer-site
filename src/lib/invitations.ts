import type { CompanyRole } from '@ledewire/node'

/**
 * The invitation tokens an invitation email carries on its signup link:
 * `company_invitation_token` (Company) and `invitation_token` (store).
 */
export interface InvitationTokens {
  company_invitation_token?: string
  invitation_token?: string
}

/** Which kind of invitation a token or a refusal is about. */
export type InvitationKind = 'company' | 'store'

function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Picks the invitation tokens out of a query string or request body, dropping anything else. */
export function pickInvitationTokens(source: Record<string, unknown>): InvitationTokens {
  const tokens: InvitationTokens = {}
  const company = nonBlank(source.company_invitation_token)
  const store = nonBlank(source.invitation_token)
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
  invitation: InvitationKind = 'company',
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

/**
 * Where a buyer goes when they signed in but an invitation they carried was
 * refused: the dashboard, which reads the reason back with
 * {@link refusedInvitationNotice}.
 */
export function refusedInvitationLanding(
  reason: string | undefined,
  invitation: InvitationKind,
): string {
  const query = new URLSearchParams({ invitation_refused: reason ?? 'invalid' })
  if (invitation === 'store') query.set('invitation', 'store')
  return `/dashboard?${query}`
}

/**
 * The dashboard notice for a {@link refusedInvitationLanding} query, or null
 * without one. Only fixed text, never the query value, reaches the page.
 */
export function refusedInvitationNotice(params: {
  invitation_refused?: string | string[]
  invitation?: string | string[]
}): string | null {
  if (typeof params.invitation_refused !== 'string') return null
  const invitation: InvitationKind = params.invitation === 'store' ? 'store' : 'company'
  const kind = invitation === 'store' ? 'store' : 'Company'
  return `You're signed in, but your ${kind} invitation wasn't accepted. ${invitationRefusalMessage(params.invitation_refused, invitation)}`
}
