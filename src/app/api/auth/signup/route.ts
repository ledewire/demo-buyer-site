import { NextRequest, NextResponse } from 'next/server'
import { createClient, LedewireError, parseExpiresAt } from '@ledewire/node'
import { getSession } from '@/lib/session'
import { config } from '@/lib/config'
import { pickInvitationTokens } from '@/lib/invitations'
import { invitationRefusedResponse, companyInvitationLanding } from '@/lib/invitation-auth'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, email, password } = body as { name?: string; email?: string; password?: string }
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email, and password are required' }, { status: 400 })
  }

  const tokens = pickInvitationTokens(body as Record<string, unknown>)
  const session = await getSession()
  const client = createClient({ baseUrl: config.ledewireBaseUrl })

  try {
    const authRes = await client.auth.signup({ name, email, password, ...tokens })
    session.accessToken = authRes.access_token
    session.refreshToken = authRes.refresh_token
    session.expiresAt = parseExpiresAt(authRes.expires_at)
    await session.save()
    // A signup carrying a Company token should have joined the Company; the
    // landing accepts the invitation itself if it didn't (#43).
    const redirect = tokens.company_invitation_token
      ? await companyInvitationLanding(client, tokens.company_invitation_token)
      : undefined
    return NextResponse.json(redirect ? { ok: true, redirect } : { ok: true }, { status: 201 })
  } catch (err) {
    const refused = invitationRefusedResponse(err)
    if (refused) return refused
    if (err instanceof LedewireError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[auth/signup] unexpected error', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
