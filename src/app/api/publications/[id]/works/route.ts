import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'

interface Params {
  params: Promise<{ id: string }>
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PAGE_LIMIT = 200

export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  const search = request.nextUrl.searchParams
  const from = search.get('from') || undefined
  const to = search.get('to') || undefined
  const cursor = search.get('cursor') || undefined

  for (const [name, value] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (value && !DATE_RE.test(value)) {
      return NextResponse.json({ error: `${name} must be YYYY-MM-DD` }, { status: 400 })
    }
  }

  try {
    const client = await createBuyerClient()
    const works = await client.publications.listWorks(id, {
      from,
      to,
      cursor,
      limit: PAGE_LIMIT,
    })
    return NextResponse.json(works)
  } catch (err) {
    return ledewireErrorResponse(err, 'publication works GET')
  }
}
