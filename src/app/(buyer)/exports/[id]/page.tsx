import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { AuthError, LedewireError, NotFoundError } from '@ledewire/node'
import ExportDetail from './ExportDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ExportPage({ params }: Props) {
  await requireAuth()
  const { id } = await params

  let acquisition
  try {
    const client = await createBuyerClient()
    acquisition = await client.acquisitions.get(id)
  } catch (err) {
    if (err instanceof NotFoundError) notFound()
    if (err instanceof AuthError) redirect('/login')
    if (err instanceof LedewireError) {
      return <p className="text-red-600 text-sm">API error: {err.message}</p>
    }
    throw err
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/exports" className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Exports
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Export</h1>
        <p className="mt-1 text-xs font-mono text-gray-500">{acquisition.id}</p>
      </div>
      <ExportDetail initialAcquisition={acquisition} />
    </div>
  )
}
