import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'
import { MAX_MACHINE_NAME_LENGTH } from '@/lib/machine-users'

export async function POST(request: NextRequest) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, description } = (body ?? {}) as { name?: unknown; description?: unknown }
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (name.trim().length > MAX_MACHINE_NAME_LENGTH) {
    return NextResponse.json(
      { error: `name must be at most ${MAX_MACHINE_NAME_LENGTH} characters` },
      { status: 400 },
    )
  }
  if (description !== undefined && typeof description !== 'string') {
    return NextResponse.json({ error: 'description must be a string' }, { status: 400 })
  }

  try {
    const client = await createBuyerClient()
    const machineUser = await client.company.machineUsers.create({
      name: name.trim(),
      ...(description?.trim() && { description: description.trim() }),
    })
    return NextResponse.json(machineUser, { status: 201 })
  } catch (err) {
    return ledewireErrorResponse(err, 'company/machine-users POST')
  }
}
