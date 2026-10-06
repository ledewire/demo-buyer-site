import { NextResponse } from 'next/server'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'
import { ledewireErrorResponse } from '@/lib/route-errors'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  try {
    const client = await createBuyerClient()
    return NextResponse.json(await client.acquisitions.getCorpus(id))
  } catch (err) {
    return ledewireErrorResponse(err, 'export corpus GET')
  }
}

export async function POST(_request: Request, { params }: Params) {
  const authResult = await requireAuthForRoute()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  try {
    const client = await createBuyerClient()
    const corpus = await client.acquisitions.buildCorpus(id)
    return NextResponse.json(corpus, { status: corpus.state === 'ready' ? 200 : 202 })
  } catch (err) {
    return ledewireErrorResponse(err, 'export corpus POST')
  }
}
