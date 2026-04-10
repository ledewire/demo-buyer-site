import type { PurchaseResponse } from '@ledewire/node'

interface Props {
  purchases: PurchaseResponse[]
}

const STATUS_CLASSES: Record<string, string> = {
  completed: 'text-green-700 bg-green-50',
  pending: 'text-yellow-700 bg-yellow-50',
  failed: 'text-red-700 bg-red-50',
  refunded: 'text-gray-600 bg-gray-100',
}

export default function PurchasesList({ purchases }: Props) {
  if (purchases.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">No purchases yet.</p>
        <p className="text-gray-400 text-xs mt-1">Content you purchase will appear here.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Content
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Seller
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {purchases.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 text-sm text-gray-800">{p.content.title}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{p.seller.name}</td>
              <td className="px-4 py-3 text-sm font-medium text-gray-800">
                ${(p.amount_cents / 100).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {new Date(p.timestamp).toLocaleDateString()}
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
