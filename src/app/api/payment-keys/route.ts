import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'
import { parsePaymentKeyRegistration } from '@/lib/payment-keys'

export async function GET() {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  try {
    const client = await createBuyerClient()
    return NextResponse.json(await client.user.paymentKeys.list())
  } catch (err) {
    return ledewireErrorResponse(err, 'payment-keys GET')
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

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
    const created = await client.user.paymentKeys.create(parsed.registration)
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    return ledewireErrorResponse(err, 'payment-keys POST')
  }
}
