import { NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { AuthError, LedewireError } from '@ledewire/node'

export async function GET() {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  try {
    const client = await createBuyerClient()
    const balance = await client.wallet.balance()
    return NextResponse.json(balance)
  } catch (err) {
    if (err instanceof AuthError)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (err instanceof LedewireError)
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    console.error('[wallet/balance] unexpected error', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
