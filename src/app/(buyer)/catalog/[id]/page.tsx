import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { createBuyerClient } from '@/lib/ledewire'
import ExportSelectionSummary from '@/components/ExportSelectionSummary'
import { AuthError, LedewireError, NotFoundError } from '@ledewire/node'
import type { Publication } from '@ledewire/node'
import WorksBrowser from './WorksBrowser'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PublicationPage({ params }: Props) {
  await requireAuth()
  const { id } = await params

  let publication: Publication | undefined
  try {
    const client = await createBuyerClient()
    publication = await client.publications.get(id)
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    // Checked before LedewireError, its base class: an unknown or unlisted id leaves
    // `publication` unset and falls through to the 404 below.
    if (!(err instanceof NotFoundError)) {
      if (err instanceof LedewireError)
        return <p className="text-red-600 text-sm">API error: {err.message}</p>
      throw err
    }
  }
  // Outside the try, so Next's 404 signal isn't caught by it.
  if (!publication) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/catalog" className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Catalog
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{publication.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {publication.domains.join(', ')}
          {publication.coverage_horizon &&
            ` · Coverage back to ${formatDate(publication.coverage_horizon.horizon_at)}`}
        </p>
      </div>
      <ExportSelectionSummary />
      <WorksBrowser
        publicationId={publication.id}
        publicationName={publication.name}
        bulkLicensable={publication.bulk_licensable}
      />
    </div>
  )
}
