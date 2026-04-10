import { NextRequest, NextResponse } from 'next/server'
import { createClient, LedewireError } from '@ledewire/node'
import { config } from '@/lib/config'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    action,
    email,
    reset_code,
    password: new_password,
  } = body as {
    action?: string
    email?: string
    reset_code?: string
    password?: string
  }

  if (!action || !email) {
    return NextResponse.json({ error: 'action and email are required' }, { status: 400 })
  }

  const client = createClient({ baseUrl: config.ledewireBaseUrl })

  try {
    if (action === 'request') {
      await client.auth.requestPasswordReset({ email })
      return NextResponse.json({ ok: true })
    }
    if (action === 'confirm') {
      if (!reset_code || !new_password) {
        return NextResponse.json({ error: 'reset_code and password are required' }, { status: 400 })
      }
      await client.auth.resetPassword({ email, reset_code, password: new_password })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    if (err instanceof LedewireError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[auth/password-reset] unexpected error', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
