import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { listItems } from '@/lib/list-items'
import { ledewireErrorResponse } from '@/lib/route-errors'
import sanitizeHtml from 'sanitize-html'
import type { Delivery } from '@/lib/purchase-delivery'

/**
 * sanitize-html's defaults (no scripts, no on* handlers, no javascript: URLs),
 * plus article images; seller links can't reach back into this tab, and seller
 * images load lazily without telling the image host which page showed them.
 */
const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: [...(sanitizeHtml.defaults.allowedAttributes.a ?? []), 'rel'],
    // referrerpolicy and loading are always overwritten by transformTags below.
    img: ['src', 'alt', 'title', 'width', 'height', 'referrerpolicy', 'loading'],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    img: sanitizeHtml.simpleTransform('img', { referrerpolicy: 'no-referrer', loading: 'lazy' }),
  },
}

export async function GET() {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  try {
    const client = await createBuyerClient()
    const purchases = listItems(await client.purchases.list())
    return NextResponse.json(purchases)
  } catch (err) {
    return ledewireErrorResponse(err, 'purchases GET')
  }
}

/** The seller supplies content_uri; link to it only if it's a web address. */
function webUrl(uri: string | undefined): string | undefined {
  if (!uri) return undefined
  try {
    const { protocol } = new URL(uri)
    return protocol === 'https:' || protocol === 'http:' ? uri : undefined
  } catch {
    return undefined
  }
}

async function readContentId(request: NextRequest): Promise<string | null> {
  try {
    const body = await request.json()
    return typeof body?.content_id === 'string' && body.content_id ? body.content_id : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const content_id = await readContentId(request)
  if (!content_id) return NextResponse.json({ error: 'content_id is required' }, { status: 400 })

  try {
    const client = await createBuyerClient()
    const purchase = await client.purchases.create({ content_id })
    const contentType = purchase.content.content_type
    const body = purchase.content_body
    return NextResponse.json<Delivery>({
      content_type: contentType,
      // Delivered as plain text, never base64; HTML is the seller's, so clean it here.
      content_body:
        contentType === 'html' && body ? sanitizeHtml(body, ARTICLE_SANITIZE_OPTIONS) : body,
      content_uri: webUrl(purchase.content_uri),
    })
  } catch (err) {
    return ledewireErrorResponse(err, 'purchases POST')
  }
}
