import { NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * Streams the corpus archive through this server. The upstream download needs
 * the buyer's bearer token, which never leaves the httpOnly session cookie.
 */
export async function GET(_request: Request, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  try {
    const client = await createBuyerClient()
    const result = await client.acquisitions.downloadCorpus(id)
    if (!result.ready) {
      return NextResponse.json(
        { error: 'The archive is not ready yet', corpus: result.corpus },
        { status: 409 },
      )
    }

    const { format } = await client.acquisitions.getCorpus(id).catch(() => ({ format: null }))
    const upstream = result.response.headers
    const headers = new Headers({
      'Content-Type': upstream.get('content-type') ?? 'application/gzip',
      'Cache-Control': 'no-store',
    })
    const safeId = id.replace(/[^A-Za-z0-9_-]/g, '')
    if (format) {
      headers.set(
        'Content-Disposition',
        `attachment; filename="export-${safeId}.${format === 'jsonl_gz' ? 'jsonl.gz' : 'tar.gz'}"`,
      )
    } else {
      headers.set(
        'Content-Disposition',
        upstream.get('content-disposition') ?? `attachment; filename="export-${safeId}.gz"`,
      )
    }
    return new Response(result.body, { status: 200, headers })
  } catch (err) {
    return ledewireErrorResponse(err, 'export download GET')
  }
}
