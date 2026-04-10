'use client'

import { useState } from 'react'
import type { UserApiKey } from '@ledewire/node'

interface Props {
  initialKeys: UserApiKey[]
}

interface NewKeyResult {
  key: string
  secret: string
}

export default function ApiKeysManager({ initialKeys }: Props) {
  const [keys, setKeys] = useState(initialKeys)
  const [newKeyResult, setNewKeyResult] = useState<NewKeyResult | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [name, setName] = useState('')
  const [spendingLimit, setSpendingLimit] = useState('')
  const [revoking, setRevoking] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCreating(true)
    try {
      const body: { name: string; spending_limit_cents?: number } = { name }
      const limitCents = spendingLimit ? Math.round(parseFloat(spendingLimit) * 100) : null
      if (limitCents && limitCents > 0) body.spending_limit_cents = limitCents

      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create key')
      } else {
        setNewKeyResult({ key: data.key, secret: data.secret })
        setShowCreateForm(false)
        setName('')
        setSpendingLimit('')
        const listRes = await fetch('/api/api-keys')
        if (listRes.ok) setKeys(await listRes.json())
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    setRevoking(id)
    try {
      const res = await fetch(`/api/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id))
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to revoke key')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </p>
      )}
      {newKeyResult && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-amber-800">
            New API key created. Copy the secret now — it will not be shown again.
          </p>
          <div className="space-y-2 text-sm font-mono">
            <div>
              <span className="text-gray-500">Key: </span>
              <span className="select-all">{newKeyResult.key}</span>
            </div>
            <div>
              <span className="text-gray-500">Secret: </span>
              <span className="select-all font-bold text-amber-900">{newKeyResult.secret}</span>
            </div>
          </div>
          <button
            onClick={() => setNewKeyResult(null)}
            className="text-sm text-amber-700 hover:text-amber-900 underline"
          >
            I&apos;ve saved the secret
          </button>
        </div>
      )}
      {!showCreateForm ? (
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Create API key
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 max-w-sm"
        >
          <h3 className="text-sm font-semibold text-gray-900">New API key</h3>
          <div>
            <label htmlFor="key-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="key-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. my-rag-agent"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="spending-limit" className="block text-sm font-medium text-gray-700">
              Spending limit (USD, optional)
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                $
              </span>
              <input
                id="spending-limit"
                type="number"
                min="0"
                step="0.01"
                value={spendingLimit}
                onChange={(e) => setSpendingLimit(e.target.value)}
                placeholder="No limit"
                className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false)
                setError(null)
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {keys.length === 0 ? (
        <p className="text-sm text-gray-500">No API keys yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Key
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spend limit
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last used
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-3 text-sm text-gray-800">{k.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{k.key}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {k.spending_limit_cents != null
                      ? `$${(k.spending_limit_cents / 100).toFixed(2)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRevoke(k.id)}
                      disabled={revoking === k.id}
                      aria-label={`Revoke ${k.name}`}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {revoking === k.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
