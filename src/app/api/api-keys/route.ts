import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { AuthError, LedewireError } from '@ledewire/node'

export async function GET() {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  try {
    const client = await createBuyerClient()
    const keys = await client.user.apiKeys.list()
    return NextResponse.json(keys)
  } catch (err) {
    if (err instanceof AuthError)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (err instanceof LedewireError)
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    console.error('[api-keys GET] unexpected error', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
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

  const { name, spending_limit_cents } = body as {
    name?: string
    spending_limit_cents?: number | null
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  try {
    const client = await createBuyerClient()
    const result = await client.user.apiKeys.create({ name, spending_limit_cents })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof AuthError)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (err instanceof LedewireError)
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    console.error('[api-keys POST] unexpected error', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
