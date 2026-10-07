'use client'

import { useState } from 'react'
import type { CompanyInvitation, CompanyMember } from '@ledewire/node'
import type { MemberActivity } from '@/lib/company-activity'
import { formatDate } from '@/lib/format'
import type { Role } from './MemberRow'
import MembersTable from './MembersTable'

interface Props {
  /** The Company's human members. */
  initialPeople: CompanyMember[]
  initialInvitations: CompanyInvitation[]
  /** The viewer's own membership id, marked "(you)" in the table. */
  currentMembershipId: string
  /** Each person's recent spend by membership id; a person missing from it has spent nothing. */
  activity: Record<string, MemberActivity>
}

/** The Company's people, the form to invite one, and the pending invitations. */
export default function PeopleManager({
  initialPeople,
  initialInvitations,
  currentMembershipId,
  activity,
}: Props) {
  const [invitations, setInvitations] = useState(initialInvitations)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('member')
  const [inviting, setInviting] = useState(false)

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
      <MembersTable
        initialMembers={initialPeople}
        showRole
        emptyMessage="No people yet."
        currentMembershipId={currentMembershipId}
        activity={activity}
      />

      <section aria-labelledby="invite-heading" className="space-y-4">
        <h2 id="invite-heading" className="text-lg font-semibold text-gray-800">
          Invite a member
        </h2>
        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
          >
            {error}
          </p>
        )}
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
      </section>
    </div>
  )
}
