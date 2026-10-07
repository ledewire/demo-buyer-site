'use client'

import { useState } from 'react'
import type { CompanyMember } from '@ledewire/node'
import type { MemberActivity } from '@/lib/company-activity'
import { INVALID_CAP_MESSAGE, parseCapCents } from '@/lib/spend-cap'
import MemberRow, { type Role } from './MemberRow'

interface Props {
  initialMembers: CompanyMember[]
  /** True for a table of people, with an Email and a Role column; false for Machine users. */
  showRole: boolean
  /** Shown in place of the table when there are no members. */
  emptyMessage: string
  /** The viewer's own membership id, marked "(you)" in the table. */
  currentMembershipId: string
  /** Each member's recent spend by membership id; a member missing from it has spent nothing. */
  activity: Record<string, MemberActivity>
}

const NO_ACTIVITY: MemberActivity = { todayCents: 0, last30Cents: 0 }

const TH = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'

/** A table of Company members whose roles and caps an admin edits in place, and removes. */
export default function MembersTable({
  initialMembers,
  showRole,
  emptyMessage,
  currentMembershipId,
  activity,
}: Props) {
  const [members, setMembers] = useState(initialMembers)
  // Take fresh members when the page data is refreshed (e.g. after adding a machine).
  const [prevInitialMembers, setPrevInitialMembers] = useState(initialMembers)
  if (initialMembers !== prevInitialMembers) {
    setPrevInitialMembers(initialMembers)
    setMembers(initialMembers)
  }
  const [capDrafts, setCapDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function updateMember(id: string, body: { role?: Role; daily_spend_limit_cents?: number }) {
    setError(null)
    setBusy(id)
    try {
      const res = await fetch(`/api/company/members/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to update member')
        return false
      }
      setMembers((prev) => prev.map((m) => (m.id === id ? data : m)))
      return true
    } catch {
      setError('Network error — please try again')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function handleSaveCap(member: CompanyMember) {
    const cents = parseCapCents(capDrafts[member.id])
    if (cents === null) {
      setError(INVALID_CAP_MESSAGE)
      return
    }
    const saved = await updateMember(member.id, { daily_spend_limit_cents: cents })
    if (saved) {
      setCapDrafts(({ [member.id]: _, ...rest }) => rest)
    }
  }

  async function handleRemove(member: CompanyMember) {
    const question =
      member.kind === 'machine'
        ? `Remove ${member.name}? This is permanent: the machine is deactivated and removal revokes all of its keys.`
        : `Remove ${member.name} from the Company?`
    if (!confirm(question)) return
    setError(null)
    setBusy(member.id)
    try {
      const res = await fetch(`/api/company/members/${encodeURIComponent(member.id)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== member.id))
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to remove member')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
        >
          {error}
        </p>
      )}
      {members.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>{showRole ? 'Email' : 'Type'}</th>
                {showRole && <th className={TH}>Role</th>}
                <th className={TH}>Daily spend cap</th>
                <th className={TH}>Spend</th>
                <th className={TH}>Joined</th>
                <th className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  activity={activity[m.id] ?? NO_ACTIVITY}
                  showRole={showRole}
                  isCurrent={m.id === currentMembershipId}
                  busy={busy === m.id}
                  capDraft={capDrafts[m.id]}
                  onRoleChange={(role) => updateMember(m.id, { role })}
                  onCapDraftChange={(draft) =>
                    setCapDrafts(({ [m.id]: _, ...rest }) =>
                      draft === undefined ? rest : { ...rest, [m.id]: draft },
                    )
                  }
                  onSaveCap={() => handleSaveCap(m)}
                  onRemove={() => handleRemove(m)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
