import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { AuthError, LedewireError } from '@ledewire/node'

export async function POST(request: NextRequest) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { amount_cents, currency } = body as { amount_cents?: number; currency?: string }
  if (!amount_cents || amount_cents <= 0) {
    return NextResponse.json({ error: 'amount_cents must be a positive integer' }, { status: 400 })
  }

  try {
    const client = await createBuyerClient()
    const session = await client.wallet.createPaymentSession({
      amount_cents,
      currency: currency ?? 'usd',
    })
    return NextResponse.json(session)
  } catch (err) {
    if (err instanceof AuthError)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (err instanceof LedewireError)
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    console.error('[wallet/payment-session] unexpected error', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
