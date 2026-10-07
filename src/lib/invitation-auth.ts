import { NextResponse } from 'next/server'
import { LedewireError } from '@ledewire/node'
import type { createClient } from '@ledewire/node'
import { companyLanding, invitationRefusalMessage } from './invitations'

/**
 * The 422 for a signup or Google sign-in refused because an invitation it
 * carried can't be accepted, or null for any other error. No account was
 * created, so the buyer stays on the form and reads why.
 */
export function invitationRefusedResponse(err: unknown): NextResponse | null {
  if (!(err instanceof LedewireError) || err.type !== 'invitation_not_accepted') return null
  const reason = typeof err.details?.reason === 'string' ? err.details.reason : undefined
  const invitation =
    typeof err.details?.invitation === 'string' ? err.details.invitation : undefined
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
 */
export async function joinedCompanyLanding(
  client: ReturnType<typeof createClient>,
): Promise<string | undefined> {
  try {
    const membership = await client.company.membership.get()
    return companyLanding(membership.role)
  } catch (err) {
    console.error('[auth] Company membership lookup after joining failed', err)
    return undefined
  }
}
