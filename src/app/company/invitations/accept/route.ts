import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { withInvitationTokens } from '@/lib/invitations'

/**
 * The link in the invitation email an existing account receives
 * (ledewire/api `CompanyInvitationMailer#invite_existing`). It hands the token
 * to a flow that accepts it: sign-in for a signed-out buyer, which carries
 * the token through Google or on to `/join`; `/join` for a signed-in one.
 * Reachable signed out, so the token survives sign-in (#45).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() || undefined
  const session = await getSession()
  const path = session.accessToken
    ? token
      ? `/join?${new URLSearchParams({ token })}`
      : '/join'
    : withInvitationTokens('/login', { company_invitation_token: token })
  return NextResponse.redirect(new URL(path, request.url))
}
