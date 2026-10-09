import { NextResponse } from 'next/server'
import { LedewireError, NotFoundError } from '@ledewire/node'
import type { createClient } from '@ledewire/node'
import {
  companyLanding,
  invitationRefusalMessage,
  refusedInvitationLanding,
  type InvitationKind,
} from './invitations'

type LedewireClient = ReturnType<typeof createClient>

/** The refused invitation's reason and kind, or null for any other error. */
function invitationRefusal(
  err: unknown,
): { reason: string | undefined; invitation: InvitationKind } | null {
  if (!(err instanceof LedewireError) || err.type !== 'invitation_not_accepted') return null
  return {
    reason: typeof err.details?.reason === 'string' ? err.details.reason : undefined,
    invitation: err.details?.invitation === 'store' ? 'store' : 'company',
  }
}

/**
 * The 422 for a signup or Google sign-in refused because an invitation it
 * carried can't be accepted, or null for any other error. No account was
 * created, so the buyer stays on the form and reads why.
 */
export function invitationRefusedResponse(err: unknown): NextResponse | null {
  const refusal = invitationRefusal(err)
  if (!refusal) return null
  return NextResponse.json(
    {
      error: invitationRefusalMessage(refusal.reason, refusal.invitation),
      type: 'invitation_not_accepted',
      reason: refusal.reason,
    },
    { status: 422 },
  )
}

/**
 * Where a buyer who signed in with a Company invitation lands: their Company
 * page for their role. `client` must already hold the new session's tokens.
 *
 * A sign-in the API reported no refusal for can still leave the buyer outside
 * the Company (#43). The buyer is signed in and the token is in hand, so this
 * accepts the invitation itself rather than dropping it silently. The account
 * exists either way, so any other failure falls back to the default landing
 * (undefined) rather than failing the sign-in.
 */
export async function companyInvitationLanding(
  client: LedewireClient,
  companyInvitationToken: string,
): Promise<string | undefined> {
  try {
    const membership = await client.company.membership.get()
    return companyLanding(membership.role)
  } catch (err) {
    if (err instanceof NotFoundError)
      return acceptUnjoinedInvitation(client, companyInvitationToken)
    console.error('[auth] Company membership lookup after joining failed', err)
    return undefined
  }
}

async function acceptUnjoinedInvitation(
  client: LedewireClient,
  token: string,
): Promise<string | undefined> {
  console.warn('[auth] Sign-in carried a Company invitation but did not join it; accepting it now')
  try {
    const membership = await client.company.invitations.accept({ token })
    return companyLanding(membership.role)
  } catch (err) {
    const refusal = invitationRefusal(err)
    if (refusal) return refusedInvitationLanding(refusal.reason, 'company')
    console.error('[auth] Accepting the Company invitation after sign-in failed', err)
    return undefined
  }
}
