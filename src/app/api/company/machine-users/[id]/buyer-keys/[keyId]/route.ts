import { NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'

interface Params {
  params: Promise<{ id: string; keyId: string }>
}

export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { id, keyId } = await params

  try {
    const client = await createBuyerClient()
    await client.company.machineUsers.buyerKeys.revoke(id, keyId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ledewireErrorResponse(err, 'company/machine-users/buyer-keys DELETE')
  }
}
