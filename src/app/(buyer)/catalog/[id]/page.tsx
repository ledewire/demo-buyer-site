import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { getAllPublications } from '@/lib/publications'
import ExportSelectionSummary from '@/components/ExportSelectionSummary'
import { AuthError, LedewireError } from '@ledewire/node'
import WorksBrowser from './WorksBrowser'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PublicationPage({ params }: Props) {
  await requireAuth()
  const { id } = await params

  let publication
  try {
    publication = (await getAllPublications()).find((p) => p.id === id)
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    if (err instanceof LedewireError) {
      return <p className="text-red-600 text-sm">API error: {err.message}</p>
    }
    throw err
  }
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
