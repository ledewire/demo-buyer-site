import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'

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

  const { name } = (body ?? {}) as { name?: unknown }
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  try {
    const client = await createBuyerClient()
    const created = await client.company.machineUsers.buyerKeys.create(id, { name: name.trim() })
    // The secret is returned once; no cache may keep a copy.
    return NextResponse.json(created, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return ledewireErrorResponse(err, 'company/machine-users/buyer-keys POST')
  }
}
