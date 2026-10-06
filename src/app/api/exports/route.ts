import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'

const MAX_URLS = 10_000

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
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

  const { urls } = (body ?? {}) as { urls?: unknown }
  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: 'urls must be a non-empty array' }, { status: 400 })
  }
  if (urls.length > MAX_URLS) {
    return NextResponse.json(
      { error: `A Selection may hold at most ${MAX_URLS} URLs` },
      { status: 400 },
    )
  }
  if (!urls.every(isHttpUrl)) {
    return NextResponse.json({ error: 'Every URL must be an http(s) URL' }, { status: 400 })
  }

  try {
    const client = await createBuyerClient()
    const acquisition = await client.acquisitions.create({ urls })
    return NextResponse.json(acquisition, { status: 201 })
  } catch (err) {
    return ledewireErrorResponse(err, 'exports POST')
  }
}
