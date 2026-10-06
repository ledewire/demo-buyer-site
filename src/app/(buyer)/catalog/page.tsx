import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { filterPublications, getAllPublications } from '@/lib/publications'
import ExportSelectionSummary from '@/components/ExportSelectionSummary'
import { AuthError, LedewireError } from '@ledewire/node'

interface Props {
  searchParams: Promise<{ q?: string; licensable?: string }>
}

export default async function CatalogPage({ searchParams }: Props) {
  await requireAuth()
  const { q = '', licensable } = await searchParams
  const licensableOnly = licensable === '1'

  try {
    const publications = filterPublications(await getAllPublications(), q, licensableOnly)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">
            Search publications, pick articles, and export them in bulk as a licensed corpus.
          </p>
        </div>

        <form method="get" className="flex flex-wrap items-center gap-3">
          <label htmlFor="q" className="sr-only">
            Search publications
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Publication name or domain"
            className="w-full sm:w-80 rounded-md border-gray-300 text-sm shadow-xs focus:border-indigo-500 focus:ring-indigo-500"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="licensable"
              value="1"
              defaultChecked={licensableOnly}
              className="rounded-sm border-gray-300 text-indigo-600"
            />
            Bulk licensable only
          </label>
          <button
            type="submit"
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Search
          </button>
        </form>

        <ExportSelectionSummary />

        {publications.length === 0 ? (
          <p className="text-sm text-gray-500 py-12 text-center">No publications match.</p>
        ) : (
          <ul className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {publications.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/catalog/${encodeURIComponent(p.id)}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500 truncate">{p.domains.join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {p.coverage_horizon && (
                      <span className="text-gray-500">
                        Coverage back to {formatDate(p.coverage_horizon.horizon_at)}
                      </span>
                    )}
                    {p.bulk_licensable && (
                      <span className="font-medium px-2 py-0.5 rounded-full text-green-700 bg-green-50">
                        Bulk licensable
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    if (err instanceof LedewireError) {
      return <p className="text-red-600 text-sm">API error: {err.message}</p>
    }
    throw err
  }
}
