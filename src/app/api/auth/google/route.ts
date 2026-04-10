import { NextRequest, NextResponse } from 'next/server'
import { createClient, LedewireError, AuthError, parseExpiresAt } from '@ledewire/node'
import { getSession } from '@/lib/session'
import { config } from '@/lib/config'

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

  const session = await getSession()
  const client = createClient({ baseUrl: config.ledewireBaseUrl })

  try {
    const authRes = await client.auth.loginWithGoogle({ id_token })
    session.accessToken = authRes.access_token
    session.refreshToken = authRes.refresh_token
    session.expiresAt = parseExpiresAt(authRes.expires_at)
    await session.save()
    return NextResponse.json({ ok: true })
  } catch (err) {
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
