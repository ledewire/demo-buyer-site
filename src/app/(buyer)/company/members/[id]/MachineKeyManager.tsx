'use client'

import { useId, useState } from 'react'
import { formatDate } from '@/lib/format'

/** The fields a Machine user's key shows in the list. */
export interface MachineKey {
  id: string
  name: string
  /** The public key id an agent presents with its secret. */
  key: string
  created_at: string
  last_used_at: string | null
}

interface Props {
  /** The kind of key, e.g. "Buyer keys". Heads the section and labels its table. */
  title: string
  /** The collection route: POST issues a key, DELETE `${apiPath}/<key id>` revokes one. */
  apiPath: string
  initialKeys: MachineKey[]
}

/** Lists, issues and revokes a Machine user's keys of one kind. */
export default function MachineKeyManager({ title, apiPath, initialKeys }: Props) {
  const [keys, setKeys] = useState(initialKeys)
  // The new key's one-time secret, with the key id an agent presents alongside it.
  const [issued, setIssued] = useState<{ key: string; secret: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const secretHeadingId = useId()
  const nameInputId = useId()

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIssuing(true)
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to issue key')
        return
      }
      const { id, name: keyName, key, created_at, last_used_at, secret } = data
      setKeys((prev) => [...prev, { id, name: keyName, key, created_at, last_used_at }])
      setIssued({ key, secret })
      setShowForm(false)
      setName('')
    } catch {
      setError('Network error — please try again')
    } finally {
      setIssuing(false)
    }
  }

  async function handleRevoke(key: MachineKey) {
    if (!confirm(`Revoke ${key.name}? Anything using it stops working. This cannot be undone.`))
      return
    setError(null)
    setRevoking(key.id)
    try {
      const res = await fetch(`${apiPath}/${encodeURIComponent(key.id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to revoke key')
        return
      }
      setKeys((prev) => prev.filter((k) => k.id !== key.id))
    } catch {
      setError('Network error — please try again')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
        >
          {error}
        </p>
      )}
      {issued && (
        <section
          aria-labelledby={secretHeadingId}
          className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3"
        >
          <h3 id={secretHeadingId} className="sr-only">
            New key secret
          </h3>
          <p className="text-sm font-medium text-amber-800">
            Copy this secret now. It won&apos;t be shown again.
          </p>
          <dl className="space-y-2 text-sm font-mono">
            <div>
              <dt className="inline text-gray-500">Key: </dt>
              <dd className="inline select-all">{issued.key}</dd>
            </div>
            <div>
              <dt className="inline text-gray-500">Secret: </dt>
              <dd className="inline select-all font-bold text-amber-900 break-all">
                {issued.secret}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => setIssued(null)}
            className="text-sm text-amber-700 hover:text-amber-900 underline"
          >
            I&apos;ve saved the secret
          </button>
        </section>
      )}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Issue key
        </button>
      ) : (
        <form
          onSubmit={handleIssue}
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 max-w-sm"
        >
          <div>
            <label htmlFor={nameInputId} className="block text-sm font-medium text-gray-700">
              Key name
            </label>
            <input
              id={nameInputId}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. production"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={issuing}
              className="px-4 py-2 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {issuing ? 'Issuing…' : 'Issue'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
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
        <p className="text-sm text-gray-500">No {title} yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table aria-label={title} className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Key
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last used
                </th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-3 text-sm text-gray-800">{k.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{k.key}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(k.created_at)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {k.last_used_at ? formatDate(k.last_used_at) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRevoke(k)}
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
    </section>
  )
}
