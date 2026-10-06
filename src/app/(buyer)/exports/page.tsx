import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { getCompanyMembership } from '@/lib/company'
import { listItems } from '@/lib/list-items'
import { formatCents, formatDate } from '@/lib/format'
import { AuthError, LedewireError } from '@ledewire/node'
import type { CompanyPurchase, WalletTransactionItem } from '@ledewire/node'

const BULK_REASONS: WalletTransactionItem['reason'][] = ['bulk_acquisition', 'bulk_hold']

interface ExportRow {
  id: string
  description: string
  amountCents: number
  status: string
  date: string
}

export default async function ExportsPage() {
  await requireAuth()

  try {
    const client = await createBuyerClient()
    const [transactions, membership] = await Promise.all([
      client.wallet.transactions(),
      getCompanyMembership(),
    ])

    // There is no list endpoint for acquisitions; each one that moved money
    // leaves exactly one bulk wallet entry whose reference_id is its id.
    const personal: ExportRow[] = listItems(transactions)
      .filter((t) => BULK_REASONS.includes(t.reason))
      .map((t) => ({
        id: t.reference_id,
        description: t.reason === 'bulk_hold' ? `${t.description} (held)` : t.description,
        amountCents: t.amount_cents,
        status: t.status,
        date: t.occurred_at,
      }))

    let company: CompanyPurchase[] | null = null
    if (membership?.role === 'admin') {
      const result = await client.company.purchases.list({
        kind: 'bulk_acquisition',
        per_page: 100,
      })
      company = result.data
    }

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Exports</h1>
            <p className="mt-1 text-sm text-gray-500">
              Bulk exports you have approved. Quotes that were never approved don&apos;t appear
              here.
            </p>
          </div>
          <Link
            href="/catalog"
            className="px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            New export
          </Link>
        </div>

        <section className="space-y-3">
          {company && <h2 className="text-lg font-semibold text-gray-800">Your exports</h2>}
          <ExportTable
            rows={personal}
            empty={
              membership
                ? 'No exports paid from your personal wallet. Exports paid by your Company are listed for its admins.'
                : 'No exports yet.'
            }
          />
        </section>

        {company && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">
              {membership!.company_name} exports
            </h2>
            <ExportTable
              showMember
              empty="Your Company has no exports yet."
              rows={company.map((p) => ({
                id: p.id,
                description: p.member.name,
                amountCents: p.amount_cents,
                status: p.status,
                date: p.occurred_at,
              }))}
            />
          </section>
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

function ExportTable({
  rows,
  empty,
  showMember = false,
}: {
  rows: ExportRow[]
  empty: string
  showMember?: boolean
}) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">{empty}</p>

  const th = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className={th}>{showMember ? 'Member' : 'Export'}</th>
            <th className={th}>Amount</th>
            <th className={th}>Status</th>
            <th className={th}>Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 text-sm">
                <Link
                  href={`/exports/${encodeURIComponent(r.id)}`}
                  className="text-indigo-700 hover:text-indigo-900 hover:underline"
                >
                  {r.description}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-800">
                {formatCents(r.amountCents)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{r.status}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{formatDate(r.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
