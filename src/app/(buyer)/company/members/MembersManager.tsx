'use client'

import { useState } from 'react'
import type { CompanyInvitation, CompanyMember } from '@ledewire/node'
import { formatCents, formatDate } from '@/lib/format'

type Role = CompanyMember['role']

interface Props {
  initialMembers: CompanyMember[]
  initialInvitations: CompanyInvitation[]
  /** The viewer's own membership id, marked "(you)" in the table. */
  currentMembershipId: string
}

const TH = 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'

export default function MembersManager({
  initialMembers,
  initialInvitations,
  currentMembershipId,
}: Props) {
  const [members, setMembers] = useState(initialMembers)
  const [invitations, setInvitations] = useState(initialInvitations)
  const [capDrafts, setCapDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('member')
  const [inviting, setInviting] = useState(false)

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
    const draft = capDrafts[member.id]
    const dollars = Number(draft)
    if (draft === undefined || draft.trim() === '' || !Number.isFinite(dollars) || dollars < 0) {
      setError('Enter a daily spend cap of $0 or more')
      return
    }
    const saved = await updateMember(member.id, {
      daily_spend_limit_cents: Math.round(dollars * 100),
    })
    if (saved) {
      setCapDrafts(({ [member.id]: _, ...rest }) => rest)
    }
  }

  async function handleRemove(member: CompanyMember) {
    if (!confirm(`Remove ${member.name} from the Company?`)) return
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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInviting(true)
    try {
      const res = await fetch('/api/company/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send invitation')
      } else {
        setInvitations((prev) => [...prev, data])
        setInviteEmail('')
        setInviteRole('member')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
        >
          {error}
        </p>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Email</th>
              <th className={TH}>Role</th>
              <th className={TH}>Daily spend cap</th>
              <th className={TH}>Joined</th>
              <th className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => {
              const disabled = busy === m.id
              const draft = capDrafts[m.id]
              return (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {m.name}
                    {m.id === currentMembershipId && (
                      <span className="ml-1 text-xs text-gray-400">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {m.kind === 'machine' ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full text-gray-600 bg-gray-100">
                        Machine user
                      </span>
                    ) : (
                      m.email
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <select
                      aria-label={`Role for ${m.name}`}
                      value={m.role}
                      disabled={disabled}
                      onChange={(e) => updateMember(m.id, { role: e.target.value as Role })}
                      className="block rounded-md border-gray-300 text-sm py-1"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {draft === undefined ? (
                      <button
                        onClick={() =>
                          setCapDrafts((prev) => ({
                            ...prev,
                            [m.id]: (m.daily_spend_limit_cents / 100).toFixed(2),
                          }))
                        }
                        className="hover:text-indigo-700 underline decoration-dotted"
                        aria-label={`Edit daily spend cap for ${m.name}`}
                      >
                        {formatCents(m.daily_spend_limit_cents)}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label={`Daily spend cap for ${m.name} (USD)`}
                          value={draft}
                          onChange={(e) =>
                            setCapDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          className="block w-24 rounded-md border-gray-300 text-sm py-1"
                        />
                        <button
                          onClick={() => handleSaveCap(m)}
                          disabled={disabled}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setCapDrafts(({ [m.id]: _, ...rest }) => rest)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(m.joined_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(m)}
                      disabled={disabled}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Invite a member</h2>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="mt-1 block w-64 rounded-md border-gray-300 shadow-xs text-sm"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="mt-1 block rounded-md border-gray-300 shadow-xs text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {inviting ? 'Sending…' : 'Send invitation'}
          </button>
        </form>

        <h3 className="text-sm font-semibold text-gray-900">Pending invitations</h3>
        {invitations.length === 0 ? (
          <p className="text-sm text-gray-500">No pending invitations.</p>
        ) : (
          <ul className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {invitations.map((inv) => (
              <li key={inv.id} className="px-4 py-3 flex justify-between text-sm">
                <span className="text-gray-800">
                  {inv.email} <span className="text-gray-500">· {inv.role}</span>
                </span>
                <span className="text-gray-500">Expires {formatDate(inv.expires_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
