import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'

/** Starts a Company wallet top-up. The API refuses anyone but a Company admin. */
export async function POST(request: NextRequest) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { amount_cents, currency } = body as { amount_cents?: unknown; currency?: unknown }
  if (typeof amount_cents !== 'number' || !Number.isInteger(amount_cents) || amount_cents <= 0) {
    return NextResponse.json({ error: 'amount_cents must be a positive integer' }, { status: 400 })
  }

  try {
    const client = await createBuyerClient()
    const session = await client.company.wallet.createPaymentSession({
      amount_cents,
      currency: typeof currency === 'string' ? currency : 'usd',
    })
    return NextResponse.json(session)
  } catch (err) {
    return ledewireErrorResponse(err, 'company/wallet/payment-session')
  }
}
