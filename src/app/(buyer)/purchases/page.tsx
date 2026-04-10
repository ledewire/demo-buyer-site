import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { AuthError, LedewireError } from '@ledewire/node'
import PurchasesList from './PurchasesList'

export default async function PurchasesPage() {
  await requireAuth()

  try {
    const client = await createBuyerClient()
    const purchases = await client.purchases.list()
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
        <PurchasesList purchases={purchases} />
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
