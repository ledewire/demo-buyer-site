import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { renderFetchError } from '@/lib/page-errors'
import ApiKeysManager from './ApiKeysManager'
import SpendCapControl from './SpendCapControl'
import PaymentKeyManager from '@/components/PaymentKeyManager'

async function loadApiKeys() {
  const client = await createBuyerClient()
  const [keys, spendCap, paymentKeys] = await Promise.all([
    client.user.apiKeys.list(),
    client.user.spendCap.get(),
    client.user.paymentKeys.list(),
  ])
  return { keys, spendCap, paymentKeys }
}

export default async function ApiKeysPage() {
  await requireAuth()

  let data: Awaited<ReturnType<typeof loadApiKeys>>
  try {
    data = await loadApiKeys()
  } catch (err) {
    return renderFetchError(err)
  }
  const { keys, spendCap, paymentKeys } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
        <p className="mt-1 text-sm text-gray-500">
          Buyer API keys let autonomous agents authenticate with LedeWire without a username and
          password. Each key is independently revocable.
        </p>
      </div>
      <SpendCapControl initialSpendCap={spendCap} />
      <ApiKeysManager initialKeys={keys} />
      <PaymentKeyManager variant="buyer" apiPath="/api/payment-keys" initialKeys={paymentKeys} />
    </div>
  )
}
