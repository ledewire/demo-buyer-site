import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { AuthError, LedewireError } from '@ledewire/node'
import TransactionList from './TransactionList'
import WalletFund from './WalletFund'

export default async function WalletPage() {
  await requireAuth()

  try {
    const client = await createBuyerClient()
    const [{ balance_cents }, transactions] = await Promise.all([
      client.wallet.balance(),
      client.wallet.transactions(),
    ])

    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Available balance</p>
            <p className="text-3xl font-bold text-gray-900">${(balance_cents / 100).toFixed(2)}</p>
          </div>
          <WalletFund />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Transaction History</h2>
          <TransactionList transactions={transactions} />
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
