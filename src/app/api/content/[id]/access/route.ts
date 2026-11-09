import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * The signed-in Buyer's preview of one work: its price and whether they can
 * afford it (`access_info`), checked before they confirm the buy.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  try {
    const client = await createBuyerClient()
    return NextResponse.json(await client.content.getWithAccess(id))
  } catch (err) {
    return ledewireErrorResponse(err, 'content access GET')
  }
}
