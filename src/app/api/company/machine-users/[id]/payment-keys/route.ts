import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'
import { parsePaymentKeyRegistration } from '@/lib/payment-keys'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parsePaymentKeyRegistration(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const client = await createBuyerClient()
    const created = await client.company.machineUsers.paymentKeys.create(id, parsed.registration)
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    return ledewireErrorResponse(err, 'company/machine-users/payment-keys POST')
  }
}
