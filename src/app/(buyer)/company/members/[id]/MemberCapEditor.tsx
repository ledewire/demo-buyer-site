'use client'

import { useState } from 'react'
import type { CompanyMember } from '@ledewire/node'
import { formatCents } from '@/lib/format'
import { INVALID_CAP_MESSAGE, parseCapCents } from '@/lib/spend-cap'

interface Props {
  member: CompanyMember
  /** The member's spend today, in cents. */
  todayCents: number
}

/** One member's daily spend cap, editable in place, with today's spend against it. */
export default function MemberCapEditor({ member: initialMember, todayCents }: Props) {
  const [member, setMember] = useState(initialMember)
  const [draft, setDraft] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cap = member.daily_spend_limit_cents

  async function handleSave() {
    const cents = parseCapCents(draft)
    if (cents === null) {
      setError(INVALID_CAP_MESSAGE)
      return
    }
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/company/members/${encodeURIComponent(member.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_spend_limit_cents: cents }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to update member')
        return
      }
      setMember(data)
      setDraft(undefined)
    } catch {
      setError('Network error — please try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
        >
          {error}
        </p>
      )}
      <div className="text-sm text-gray-800">
        <span className="text-gray-500">Daily spend cap: </span>
        {draft === undefined ? (
          <button
            onClick={() => setDraft((cap / 100).toFixed(2))}
            className="hover:text-indigo-700 underline decoration-dotted"
            aria-label={`Edit daily spend cap for ${member.name}`}
          >
            {formatCents(cap)}
          </button>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="text-gray-500">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              aria-label={`Daily spend cap for ${member.name} (USD)`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="block w-24 rounded-md border-gray-300 text-sm py-1"
            />
            <button
              onClick={handleSave}
              disabled={busy}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setDraft(undefined)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-800">
        <span>{`${formatCents(todayCents)} of ${formatCents(cap)} today`}</span>
        {todayCents >= cap && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full text-red-700 bg-red-50">
            At cap
          </span>
        )}
      </div>
    </div>
  )
}
