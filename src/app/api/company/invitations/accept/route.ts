import { NextRequest, NextResponse } from 'next/server'
import { LedewireError, NotFoundError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'

/** Accepts a Company invitation for the signed-in buyer. */
export async function POST(request: NextRequest) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { token } = body as { token?: unknown }
  if (typeof token !== 'string' || !token.trim()) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  try {
    const client = await createBuyerClient()
    const membership = await client.company.invitations.accept({ token: token.trim() })
    return NextResponse.json(membership)
  } catch (err) {
    if (err instanceof NotFoundError)
      return NextResponse.json(
        { error: 'No pending invitation with this token is addressed to your email.' },
        { status: 404 },
      )
    if (err instanceof LedewireError && err.statusCode === 409)
      return NextResponse.json({ error: 'You already belong to a Company.' }, { status: 409 })
    if (err instanceof LedewireError && err.statusCode === 410)
      return NextResponse.json(
        {
          error: 'This invitation has expired or was withdrawn. Ask a Company admin to resend it.',
        },
        { status: 410 },
      )
    return ledewireErrorResponse(err, 'company/invitations/accept')
  }
}
