import { NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'

interface Params {
  params: Promise<{ id: string; action: string }>
}

type Client = Awaited<ReturnType<typeof createBuyerClient>>

/** Maps a URL action to its acquisitions call. Anything else is a 404. */
function actionFor(client: Client, action: string) {
  switch (action) {
    case 'acknowledge':
      return (id: string) => client.acquisitions.acknowledgeExclusions(id)
    case 'authorize':
      return (id: string) => client.acquisitions.authorize(id)
    case 'requote':
      return (id: string) => client.acquisitions.requote(id)
    case 'cancel':
      return (id: string) => client.acquisitions.cancel(id)
    default:
      return null
  }
}

export async function POST(_request: Request, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { id, action } = await params

  try {
    const client = await createBuyerClient()
    const run = actionFor(client, action)
    if (!run) return NextResponse.json({ error: 'Unknown action' }, { status: 404 })
    return NextResponse.json(await run(id))
  } catch (err) {
    return ledewireErrorResponse(err, `export ${action} POST`)
  }
}
