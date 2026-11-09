import { NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'
import { isPurchaseId, licenceFilename } from '@/lib/licence-document'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * Sends back the licence document a purchase was delivered under. The upstream read
 * needs the buyer's bearer token, which never leaves the httpOnly session cookie.
 *
 * The content type is the work's source's choice, so the document is always an
 * attachment and never sniffed: it must not render inline on this origin.
 */
export async function GET(_request: Request, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  if (!isPurchaseId(id)) {
    return NextResponse.json({ error: 'Invalid purchase id' }, { status: 400 })
  }

  try {
    const client = await createBuyerClient()
    const { body, contentType } = await client.purchases.licenseDocument(id)
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${licenceFilename(id, contentType)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return ledewireErrorResponse(err, 'purchase licence GET')
  }
}
