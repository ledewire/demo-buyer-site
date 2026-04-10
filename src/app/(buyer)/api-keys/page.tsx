import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { AuthError, LedewireError } from '@ledewire/node'
import ApiKeysManager from './ApiKeysManager'

export default async function ApiKeysPage() {
  await requireAuth()

  try {
    const client = await createBuyerClient()
    const keys = await client.user.apiKeys.list()
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="mt-1 text-sm text-gray-500">
            Buyer API keys let autonomous agents authenticate with LedeWire without a username and
            password. Each key is independently revocable.
          </p>
        </div>
        <ApiKeysManager initialKeys={keys} />
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
