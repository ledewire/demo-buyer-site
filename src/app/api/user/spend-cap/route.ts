import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'
import { INVALID_CAP_CENTS_MESSAGE, isCapCents } from '@/lib/spend-cap'

/** Sets the signed-in Buyer's daily Spend cap, which covers every key they hold. */
export async function PATCH(request: NextRequest) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // The cap can be changed but never removed, so null is refused here, before the SDK.
  const { daily_spend_limit_cents: cap } = (body ?? {}) as { daily_spend_limit_cents?: unknown }
  if (!isCapCents(cap)) {
    return NextResponse.json({ error: INVALID_CAP_CENTS_MESSAGE }, { status: 400 })
  }

  try {
    const client = await createBuyerClient()
    const spendCap = await client.user.spendCap.update({ daily_spend_limit_cents: cap })
    return NextResponse.json(spendCap)
  } catch (err) {
    return ledewireErrorResponse(err, 'user/spend-cap PATCH')
  }
}
