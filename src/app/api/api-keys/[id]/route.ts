import { NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { AuthError, LedewireError, NotFoundError } from '@ledewire/node'

interface Params {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  try {
    const client = await createBuyerClient()
    await client.user.apiKeys.revoke(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof NotFoundError)
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    if (err instanceof AuthError)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (err instanceof LedewireError)
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    console.error('[api-keys DELETE] unexpected error', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
