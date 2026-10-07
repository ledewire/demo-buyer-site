import type { CompanyPendingTopUp } from '@ledewire/node'
import { formatCents, formatDate } from '@/lib/format'

interface Props {
  topUps: CompanyPendingTopUp[]
}

const STATUS_LABELS: Record<CompanyPendingTopUp['status'], string> = {
  pending: 'Pending',
  awaiting_verification: 'Awaiting verification',
  processing: 'Processing',
}

export default function PendingTopUps({ topUps }: Props) {
  if (topUps.length === 0) {
    return <p className="text-sm text-gray-500">No top-ups waiting to settle.</p>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Started
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Expected
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {topUps.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-3 text-sm text-gray-500">{formatDate(t.created_at)}</td>
              <td className="px-4 py-3 text-sm font-medium text-gray-800">
                {formatCents(t.amount_cents)}
              </td>
              <td className="px-4 py-3">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full text-yellow-700 bg-yellow-50">
                  {STATUS_LABELS[t.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {formatDate(t.expected_debit_date)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
