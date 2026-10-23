import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'
import { parseSearchFilters } from '@/lib/search'

/** One page of content search results: `?q=…&max_price=…` (dollars) `&cursor=…`. */
export async function GET(request: NextRequest) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const search = request.nextUrl.searchParams
  const filters = parseSearchFilters(search.get('q'), search.get('max_price'))
  if (!filters) return NextResponse.json({ error: 'q is required' }, { status: 400 })
  if ('error' in filters) return NextResponse.json({ error: filters.error }, { status: 400 })
  const cursor = search.get('cursor') || undefined

  try {
    const client = await createBuyerClient()
    const page = await client.content.search(cursor ? { ...filters, cursor } : filters)
    return NextResponse.json(page)
  } catch (err) {
    return ledewireErrorResponse(err, 'search GET')
  }
}
