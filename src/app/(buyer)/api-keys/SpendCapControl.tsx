'use client'

import { useState } from 'react'
import type { UserSpendCap } from '@ledewire/node'
import { formatCents } from '@/lib/format'
import { INVALID_CAP_MESSAGE, parseCapCents } from '@/lib/spend-cap'

interface Props {
  initialSpendCap: UserSpendCap
}

/**
 * The instant the spend window rolls, as a clock time in the window's own timezone. The zone
 * is explicit, so the server render and the browser agree whatever the viewer's locale.
 */
function resetTime({ resets_at, spend_window_timezone }: UserSpendCap): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: spend_window_timezone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(resets_at))
}

/**
 * The Buyer's Agent spend cap: one daily budget across every key they hold. It can be changed
 * but never removed — the API refuses a null cap — so a blank or negative draft is stopped
 * here, before any request.
 */
export default function SpendCapControl({ initialSpendCap }: Props) {
  const [spendCap, setSpendCap] = useState(initialSpendCap)
  /** The unsaved cap in dollars, or undefined when the cap isn't being edited. */
  const [draft, setDraft] = useState<string | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cap = spendCap.cap_cents

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const cents = parseCapCents(draft)
    if (cents === null) {
      setError(INVALID_CAP_MESSAGE)
      return
    }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/user/spend-cap', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_spend_limit_cents: cents }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to update the daily agent budget')
        return
      }
      setSpendCap(data)
      setDraft(undefined)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-2 max-w-xl">
      <h2 className="text-sm font-semibold text-gray-900">Daily agent budget</h2>
      <p className="text-sm text-gray-500">
        Applies to all of your API keys together, not to each key.
      </p>
      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
        >
          {error}
        </p>
      )}
      {draft === undefined ? (
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-gray-900">
            {cap === null ? 'No limit' : formatCents(cap)}
          </span>
          {/* A Company member's cap is the membership's, which only the Company's admins set. */}
          {spendCap.company_name !== null ? (
            <span className="text-sm text-gray-500">{`Set by ${spendCap.company_name}'s admins`}</span>
          ) : (
            <button
              onClick={() => setDraft(cap === null ? '' : (cap / 100).toFixed(2))}
              aria-label={cap === null ? 'Set daily agent budget' : 'Change daily agent budget'}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              {cap === null ? 'Set' : 'Change'}
            </button>
          )}
        </div>
      ) : (
        // noValidate: parseCapCents is the one check, so every bad draft gets the same message.
        <form onSubmit={handleSave} noValidate className="inline-flex items-center gap-2">
          <span className="text-gray-500">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            aria-label="Daily agent budget (USD)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="block w-28 rounded-md border-gray-300 text-sm py-1"
          />
          <button
            type="submit"
            disabled={saving}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(undefined)
              setError(null)
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </form>
      )}
      <p className="text-xs text-gray-500">
        {`Today's budget resets at ${resetTime(spendCap)} (${spendCap.spend_window_timezone}).`}
      </p>
    </section>
  )
}
