'use client'

import { useState } from 'react'
import type { CompanyMember } from '@ledewire/node'
import { INVALID_CAP_MESSAGE, parseCapCents } from '@/lib/spend-cap'
import CapField from '../CapField'
import CapUsage from '../CapUsage'

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
        <CapField
          name={member.name}
          capCents={cap}
          draft={draft}
          busy={busy}
          onDraftChange={setDraft}
          onSave={handleSave}
        />
      </div>
      <div className="text-sm text-gray-800">
        <CapUsage todayCents={todayCents} capCents={cap} />
      </div>
    </div>
  )
}
