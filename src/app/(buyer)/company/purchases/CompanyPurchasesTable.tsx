import Link from 'next/link'
import type { CompanyPurchase } from '@ledewire/node'
import { formatCents, formatDate } from '@/lib/format'

interface Props {
  purchases: CompanyPurchase[]
  emptyMessage?: string
}

const STATUS_CLASSES: Record<string, string> = {
  completed: 'text-green-700 bg-green-50',
  settled: 'text-green-700 bg-green-50',
  pending: 'text-yellow-700 bg-yellow-50',
  authorized: 'text-yellow-700 bg-yellow-50',
  acquiring: 'text-yellow-700 bg-yellow-50',
  failed: 'text-red-700 bg-red-50',
  refunded: 'text-gray-600 bg-gray-100',
  reverted: 'text-gray-600 bg-gray-100',
  cancelled: 'text-gray-600 bg-gray-100',
}

const KIND_LABELS: Record<CompanyPurchase['kind'], string> = {
  purchase: 'Purchase',
  bulk_acquisition: 'Bulk export',
}

const TH = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'
const TAG = 'ml-2 text-xs font-medium px-1.5 py-0.5 rounded-sm text-gray-600 bg-gray-100'

export default function CompanyPurchasesTable({
  purchases,
  emptyMessage = 'No purchases match these filters.',
}: Props) {
  if (purchases.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className={TH}>Date</th>
            <th className={TH}>Member</th>
            <th className={TH}>Kind</th>
            <th className={TH}>Reference</th>
            <th className={TH}>Amount</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {purchases.map((p) => (
            <tr key={`${p.kind}-${p.id}`}>
              <td className="px-4 py-3 text-sm text-gray-500">{formatDate(p.occurred_at)}</td>
              <td className="px-4 py-3 text-sm text-gray-800">
                {p.member.name}
                {p.member.kind === 'machine' && <span className={TAG}>machine</span>}
                {p.member.left_at && <span className={TAG}>left</span>}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{KIND_LABELS[p.kind] ?? p.kind}</td>
              <td className="px-4 py-3 text-sm font-mono text-gray-500">
                {p.kind === 'bulk_acquisition' ? (
                  <Link
                    href={`/exports/${encodeURIComponent(p.id)}`}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    {p.id}
                  </Link>
                ) : (
                  p.id
                )}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-gray-800">
                {formatCents(p.amount_cents)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    STATUS_CLASSES[p.status] ?? 'text-gray-600 bg-gray-100'
                  }`}
                >
                  {p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
