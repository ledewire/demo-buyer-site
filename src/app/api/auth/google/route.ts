import { NextRequest, NextResponse } from 'next/server'
import { createClient, LedewireError, AuthError, parseExpiresAt } from '@ledewire/node'
import { getSession } from '@/lib/session'
import { config } from '@/lib/config'
import { pickInvitationTokens, refusedInvitationLanding } from '@/lib/invitations'
import { invitationRefusedResponse, joinedCompanyLanding } from '@/lib/invitation-auth'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id_token } = body as { id_token?: string }
  if (!id_token) {
    return NextResponse.json({ error: 'id_token is required' }, { status: 400 })
  }

  const tokens = pickInvitationTokens(body as Record<string, unknown>)
  const session = await getSession()
  const client = createClient({ baseUrl: config.ledewireBaseUrl })

  try {
    const authRes = await client.auth.loginWithGoogle({ id_token, ...tokens })
    session.accessToken = authRes.access_token
    session.refreshToken = authRes.refresh_token
    session.expiresAt = parseExpiresAt(authRes.expires_at)
    await session.save()
    // A new account reports no `invitations`: it joined, or the call was refused
    // with a 422. An existing account is signed in either way and told here.
    const { company, store } = authRes.invitations ?? {}
    if (company?.accepted === false) {
      return NextResponse.json({
        ok: true,
        redirect: refusedInvitationLanding(company.reason, 'company'),
      })
    }
    if (store?.accepted === false) {
      return NextResponse.json({
        ok: true,
        redirect: refusedInvitationLanding(store.reason, 'store'),
      })
    }
    if (!tokens.company_invitation_token) return NextResponse.json({ ok: true })

    const redirect = await joinedCompanyLanding(client)
    return NextResponse.json(redirect ? { ok: true, redirect } : { ok: true })
  } catch (err) {
    const refused = invitationRefusedResponse(err)
    if (refused) return refused
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Google sign-in failed' }, { status: 401 })
    }
    if (err instanceof LedewireError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[auth/google] unexpected error', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
