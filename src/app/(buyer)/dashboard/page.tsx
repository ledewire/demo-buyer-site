import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { AuthError, LedewireError } from '@ledewire/node'

export default async function DashboardPage() {
  await requireAuth()

  try {
    const client = await createBuyerClient()
    const [{ balance_cents }, purchases] = await Promise.all([
      client.wallet.balance(),
      client.purchases.list(),
    ])

    const totalSpent = purchases.reduce((sum, p) => sum + p.amount_cents, 0)
    const recentPurchases = purchases.slice(0, 5)

    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard label="Wallet Balance" value={`$${(balance_cents / 100).toFixed(2)}`} />
          <StatCard label="Total Purchases" value={String(purchases.length)} />
          <StatCard label="Total Spent" value={`$${(totalSpent / 100).toFixed(2)}`} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Purchases</h2>
          {recentPurchases.length === 0 ? (
            <p className="text-sm text-gray-500">No purchases yet.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {recentPurchases.map((p) => (
                <div key={p.id} className="px-4 py-3 flex justify-between">
                  <span className="text-sm text-gray-800">{p.content.title}</span>
                  <span className="text-sm font-medium text-gray-600">
                    ${(p.amount_cents / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-1">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}
