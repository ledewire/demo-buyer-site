import { NextResponse } from 'next/server'
import { LedewireError, NotFoundError } from '@ledewire/node'
import type { createClient } from '@ledewire/node'
import { companyLanding, invitationRefusalMessage, refusedInvitationLanding } from './invitations'

/**
 * The 422 for a signup or Google sign-in refused because an invitation it
 * carried can't be accepted, or null for any other error. No account was
 * created, so the buyer stays on the form and reads why.
 */
export function invitationRefusedResponse(err: unknown): NextResponse | null {
  if (!(err instanceof LedewireError) || err.type !== 'invitation_not_accepted') return null
  const reason = typeof err.details?.reason === 'string' ? err.details.reason : undefined
  const invitation = err.details?.invitation === 'store' ? 'store' : 'company'
  return NextResponse.json(
    { error: invitationRefusalMessage(reason, invitation), type: err.type, reason },
    { status: 422 },
  )
}

/**
 * Where a buyer who just joined a Company lands: their Company page for their
 * role. `client` must already hold the new session's tokens. The account
 * exists either way, so a failed lookup falls back to the default landing
 * (undefined) rather than failing the sign-in.
 *
 * A sign-in the API reported no refusal for can still leave the buyer outside
 * the Company (#43). The buyer is signed in and the token is in hand, so this
 * accepts the invitation itself rather than dropping it silently.
 */
export async function joinedCompanyLanding(
  client: ReturnType<typeof createClient>,
  companyInvitationToken: string,
): Promise<string | undefined> {
  try {
    const membership = await client.company.membership.get()
    return companyLanding(membership.role)
  } catch (err) {
    if (err instanceof NotFoundError)
      return acceptLeftOverInvitation(client, companyInvitationToken)
    console.error('[auth] Company membership lookup after joining failed', err)
    return undefined
  }
}

async function acceptLeftOverInvitation(
  client: ReturnType<typeof createClient>,
  token: string,
): Promise<string | undefined> {
  console.warn('[auth] Sign-in carried a Company invitation but did not join it; accepting it now')
  try {
    const membership = await client.company.invitations.accept({ token })
    return companyLanding(membership.role)
  } catch (err) {
    if (err instanceof LedewireError && err.type === 'invitation_not_accepted') {
      const reason = typeof err.details?.reason === 'string' ? err.details.reason : undefined
      return refusedInvitationLanding(reason, 'company')
    }
    console.error('[auth] Accepting the Company invitation after sign-in failed', err)
    return undefined
  }
}
