import { NextRequest, NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { listItems } from '@/lib/list-items'
import { ledewireErrorResponse } from '@/lib/route-errors'
import { isWebUrl } from '@/lib/web-url'
import sanitizeHtml from 'sanitize-html'
import type { Delivery } from '@/lib/purchase-delivery'
import type { PurchaseCreateRequest } from '@ledewire/node'

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

/**
 * The work to buy, and the price the buyer confirmed for it. The SDK types both as optional,
 * but the API refuses a purchase without either (ledewire/ledewire-js-sdk#64).
 */
type Order = Required<PurchaseCreateRequest>

async function readOrder(request: NextRequest): Promise<Order | null> {
  try {
    const { content_id, price_cents } = (await request.json()) ?? {}
    const validId = typeof content_id === 'string' && content_id
    const validPrice = Number.isInteger(price_cents) && price_cents >= 0
    return validId && validPrice ? { content_id, price_cents } : null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const order = await readOrder(request)
  if (!order) {
    return NextResponse.json(
      { error: 'content_id and a whole, non-negative price_cents are required' },
      { status: 400 },
    )
  }

  try {
    const client = await createBuyerClient()
    const purchase = await client.purchases.create(order)
    const contentType = purchase.content.content_type
    const body = purchase.content_body
    return NextResponse.json<Delivery>({
      content_type: contentType,
      // Delivered as plain text, never base64; HTML is the seller's, so clean it here.
      content_body:
        contentType === 'html' && body ? sanitizeHtml(body, ARTICLE_SANITIZE_OPTIONS) : body,
      // The seller supplies content_uri; link to it only if it's a web address.
      content_uri: isWebUrl(purchase.content_uri) ? purchase.content_uri : undefined,
    })
  } catch (err) {
    return ledewireErrorResponse(err, 'purchases POST')
  }
}
