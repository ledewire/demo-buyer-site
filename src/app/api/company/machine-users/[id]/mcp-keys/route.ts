import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'
import { MCP_KEY_SCOPES, isMcpKeyScope } from '@/lib/machine-users'

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

  const { label, scopes } = (body ?? {}) as { label?: unknown; scopes?: unknown }
  if (typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }
  if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every(isMcpKeyScope)) {
    return NextResponse.json(
      { error: `scopes must be one or more of ${MCP_KEY_SCOPES.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    const client = await createBuyerClient()
    const created = await client.company.machineUsers.mcpKeys.create(id, {
      label: label.trim(),
      scopes,
    })
    // The secret is returned once; no cache may keep a copy.
    return NextResponse.json(created, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return ledewireErrorResponse(err, 'company/machine-users/mcp-keys POST')
  }
}
