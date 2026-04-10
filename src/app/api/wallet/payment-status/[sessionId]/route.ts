import { NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { AuthError, LedewireError } from '@ledewire/node'

interface Params {
  params: Promise<{ sessionId: string }>
}

export async function GET(_request: Request, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { sessionId } = await params

  try {
    const client = await createBuyerClient()
    const status = await client.wallet.getPaymentStatus(sessionId)
    return NextResponse.json(status)
  } catch (err) {
    if (err instanceof AuthError)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (err instanceof LedewireError)
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    console.error('[wallet/payment-status] unexpected error', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
