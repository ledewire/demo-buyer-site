import type { WalletTransactionItem } from '@ledewire/node'

interface Props {
  transactions: WalletTransactionItem[]
}

const REASON_LABELS: Record<WalletTransactionItem['reason'], string> = {
  wallet_funding: 'Wallet funding',
  purchase: 'Purchase',
  refund: 'Refund',
  bulk_acquisition: 'Bulk export',
  bulk_hold: 'Bulk export hold',
}

const STATUS_CLASSES: Record<WalletTransactionItem['status'], string> = {
  completed: 'text-green-700 bg-green-50',
  pending: 'text-yellow-700 bg-yellow-50',
  failed: 'text-red-700 bg-red-50',
  cancelled: 'text-gray-600 bg-gray-100',
  refunded: 'text-gray-600 bg-gray-100',
  reverted: 'text-gray-600 bg-gray-100',
  settled: 'text-green-700 bg-green-50',
  authorized: 'text-blue-700 bg-blue-50',
  acquiring: 'text-blue-700 bg-blue-50',
}

export default function TransactionList({ transactions }: Props) {
  if (transactions.length === 0) {
    return <p className="text-sm text-gray-500">No transactions yet.</p>
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Balance after
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td className="px-4 py-3 text-sm text-gray-800">
                {REASON_LABELS[tx.reason]}
                <span className="ml-1 text-xs text-gray-400">({tx.type})</span>
              </td>
              <td
                className={`px-4 py-3 text-sm font-medium ${
                  tx.type === 'credit' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {tx.type === 'credit' ? '+' : '-'}${(tx.amount_cents / 100).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                ${(tx.balance_after_cents / 100).toFixed(2)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASSES[tx.status]}`}
                >
                  {tx.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
