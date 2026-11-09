'use client'

import { useId, useState } from 'react'
import type { PaymentKey } from '@ledewire/node'
import { formatDate } from '@/lib/format'
import { PAYMENT_KEY_LIMIT } from '@/lib/payment-keys'
import PaymentKeyGuidance from './PaymentKeyGuidance'

interface Props {
  /** `buyer` for the signed-in Buyer's own keys; `machine` for a Machine user's. */
  variant: 'buyer' | 'machine'
  /** The collection route: POST registers a key, DELETE `${apiPath}/<key id>` revokes one. */
  apiPath: string
  /** The active keys, in the order the API lists them. */
  initialKeys: PaymentKey[]
}

const INPUT_CLASSES =
  'mt-1 block w-full rounded-md border-gray-300 shadow-xs font-mono focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-400'
const TH_CLASSES = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'

/**
 * Lists, registers and revokes Payment keys: public Ed25519 keys that sign x402 payments. The
 * form takes only a key's name, public key and proof; the private half stays with its holder.
 */
export default function PaymentKeyManager({ variant, apiPath, initialKeys }: Props) {
  const [keys, setKeys] = useState(initialKeys)
  const [fields, setFields] = useState({ name: '', public_key: '', proof: '' })
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const headingId = useId()
  const formHeadingId = useId()
  const limitNoteId = useId()
  const atLimit = keys.length >= PAYMENT_KEY_LIMIT

  function setField(field: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setRegisterError(null)
    setRegistering(true)
    try {
      const { name, public_key, proof } = fields
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, public_key, proof }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRegisterError(data.error ?? 'Failed to register key')
        return
      }
      // A Buyer's keys are listed newest first, a Machine user's oldest first.
      setKeys((prev) => (variant === 'buyer' ? [data, ...prev] : [...prev, data]))
      setFields({ name: '', public_key: '', proof: '' })
    } catch {
      setRegisterError('Network error — please try again')
    } finally {
      setRegistering(false)
    }
  }

  async function handleRevoke(key: PaymentKey) {
    if (
      !confirm(
        `Revoke ${key.name}? It stops signing payments at once; purchases it paid for still name it. This cannot be undone.`,
      )
    )
      return
    setRevokeError(null)
    setRevoking(key.id)
    try {
      const res = await fetch(`${apiPath}/${encodeURIComponent(key.id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setRevokeError(data.error ?? 'Failed to revoke key')
        return
      }
      setKeys((prev) => prev.filter((k) => k.id !== key.id))
    } catch {
      setRevokeError('Network error — please try again')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold text-gray-800">
          Payment keys
        </h2>
        <p className="text-sm text-gray-500">
          {keys.length} of {PAYMENT_KEY_LIMIT}
        </p>
      </div>
      <p className="text-sm text-gray-500">
        A Payment key signs x402 payments. It can&apos;t log in, and LedeWire never holds its
        private half. To rotate a key, register the replacement before revoking the old one.
      </p>
      {revokeError && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
        >
          {revokeError}
        </p>
      )}

      {keys.length === 0 ? (
        <p className="text-sm text-gray-500">No Payment keys yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table aria-label="Payment keys" className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className={TH_CLASSES}>Name</th>
                <th className={TH_CLASSES}>Public key</th>
                <th className={TH_CLASSES}>Created</th>
                <th className={TH_CLASSES}>Last used</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-3 text-sm text-gray-800">{k.name}</td>
                  <td
                    className="px-4 py-3 text-sm font-mono text-gray-600 max-w-[12rem] truncate"
                    title={k.public_key}
                  >
                    {k.public_key}
                  </td>
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

      <form
        aria-labelledby={formHeadingId}
        aria-describedby={atLimit ? limitNoteId : undefined}
        onSubmit={handleRegister}
        className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 max-w-2xl"
      >
        <h3 id={formHeadingId} className="text-sm font-semibold text-gray-900">
          Register a Payment key
        </h3>
        {atLimit && (
          <p id={limitNoteId} className="text-sm text-amber-800 bg-amber-50 rounded-sm px-3 py-2">
            {PAYMENT_KEY_LIMIT} active keys is the most allowed. Revoke a key before registering
            another.
          </p>
        )}
        <PaymentKeyGuidance variant={variant} />
        {registerError && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
          >
            {registerError}
          </p>
        )}
        <fieldset disabled={atLimit} className="space-y-4">
          <div>
            <label
              htmlFor={`${formHeadingId}-name`}
              className="block text-sm font-medium text-gray-700"
            >
              Name
            </label>
            <input
              id={`${formHeadingId}-name`}
              type="text"
              required
              autoComplete="off"
              value={fields.name}
              onChange={setField('name')}
              placeholder="e.g. research-agent"
              className={INPUT_CLASSES}
            />
          </div>
          <div>
            <label
              htmlFor={`${formHeadingId}-public-key`}
              className="block text-sm font-medium text-gray-700"
            >
              Public key
            </label>
            <input
              id={`${formHeadingId}-public-key`}
              type="text"
              required
              autoComplete="off"
              spellCheck={false}
              value={fields.public_key}
              onChange={setField('public_key')}
              placeholder="43 characters of base64url"
              className={INPUT_CLASSES}
            />
          </div>
          <div>
            <label
              htmlFor={`${formHeadingId}-proof`}
              className="block text-sm font-medium text-gray-700"
            >
              Proof
            </label>
            <textarea
              id={`${formHeadingId}-proof`}
              required
              rows={2}
              autoComplete="off"
              spellCheck={false}
              value={fields.proof}
              onChange={setField('proof')}
              placeholder="86 characters of base64url"
              className={INPUT_CLASSES}
            />
          </div>
          <button
            type="submit"
            disabled={registering}
            className="px-4 py-2 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {registering ? 'Registering…' : 'Register key'}
          </button>
        </fieldset>
      </form>
    </section>
  )
}
