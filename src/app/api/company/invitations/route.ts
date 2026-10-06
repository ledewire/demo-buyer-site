import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'

const ROLES = ['admin', 'member'] as const
type Role = (typeof ROLES)[number]

export async function GET() {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  try {
    const client = await createBuyerClient()
    const invitations = await client.company.invitations.list()
    return NextResponse.json(invitations)
  } catch (err) {
    return ledewireErrorResponse(err, 'company/invitations GET')
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

  const { email, role } = body as { email?: unknown; role?: unknown }
  if (typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }
  if (role !== undefined && !ROLES.includes(role as Role)) {
    return NextResponse.json({ error: 'role must be admin or member' }, { status: 400 })
  }

  try {
    const client = await createBuyerClient()
    const invitation = await client.company.invitations.create({
      email: email.trim(),
      ...(role !== undefined && { role: role as Role }),
    })
    return NextResponse.json(invitation, { status: 201 })
  } catch (err) {
    return ledewireErrorResponse(err, 'company/invitations POST')
  }
}
