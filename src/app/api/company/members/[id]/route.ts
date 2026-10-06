import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'

const ROLES = ['admin', 'member'] as const
type Role = (typeof ROLES)[number]

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { role, daily_spend_limit_cents } = body as {
    role?: unknown
    daily_spend_limit_cents?: unknown
  }
  if (role === undefined && daily_spend_limit_cents === undefined) {
    return NextResponse.json(
      { error: 'role or daily_spend_limit_cents is required' },
      { status: 400 },
    )
  }
  if (role !== undefined && !ROLES.includes(role as Role)) {
    return NextResponse.json({ error: 'role must be admin or member' }, { status: 400 })
  }
  if (
    daily_spend_limit_cents !== undefined &&
    !(Number.isInteger(daily_spend_limit_cents) && (daily_spend_limit_cents as number) >= 0)
  ) {
    return NextResponse.json(
      { error: 'daily_spend_limit_cents must be a non-negative integer' },
      { status: 400 },
    )
  }

  try {
    const client = await createBuyerClient()
    const member = await client.company.members.update(id, {
      ...(role !== undefined && { role: role as Role }),
      ...(daily_spend_limit_cents !== undefined && {
        daily_spend_limit_cents: daily_spend_limit_cents as number,
      }),
    })
    return NextResponse.json(member)
  } catch (err) {
    return ledewireErrorResponse(err, 'company/members PATCH')
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  try {
    const client = await createBuyerClient()
    await client.company.members.remove(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ledewireErrorResponse(err, 'company/members DELETE')
  }
}
