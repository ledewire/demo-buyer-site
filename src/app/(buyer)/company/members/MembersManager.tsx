'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CompanyInvitation, CompanyMember } from '@ledewire/node'
import { formatDate } from '@/lib/format'
import { MAX_MACHINE_NAME_LENGTH } from '@/lib/machine-users'
import MemberRow, { type Role } from './MemberRow'

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
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  // Take fresh members when the page data is refreshed (e.g. after adding a machine).
  const [prevInitialMembers, setPrevInitialMembers] = useState(initialMembers)
  if (initialMembers !== prevInitialMembers) {
    setPrevInitialMembers(initialMembers)
    setMembers(initialMembers)
  }
  const [invitations, setInvitations] = useState(initialInvitations)
  const [capDrafts, setCapDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('member')
  const [inviting, setInviting] = useState(false)
  const [machineName, setMachineName] = useState('')
  const [machineDescription, setMachineDescription] = useState('')
  const [addingMachine, setAddingMachine] = useState(false)

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

  async function handleAddMachine(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setAddingMachine(true)
    try {
      const res = await fetch('/api/company/machine-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: machineName,
          ...(machineDescription.trim() && { description: machineDescription.trim() }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to add machine user')
      } else {
        // The API returns a Machine user, not a membership, so reload the members list.
        setMachineName('')
        setMachineDescription('')
        router.refresh()
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setAddingMachine(false)
    }
  }

  const people = members.filter((m) => m.kind !== 'machine')
  const machines = members.filter((m) => m.kind === 'machine')

  function renderTable(list: CompanyMember[], showRole: boolean, emptyMessage: string) {
    if (list.length === 0) return <p className="text-sm text-gray-500">{emptyMessage}</p>
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>{showRole ? 'Email' : 'Type'}</th>
              {showRole && <th className={TH}>Role</th>}
              <th className={TH}>Daily spend cap</th>
              <th className={TH}>Joined</th>
              <th className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
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
    )
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

      <section aria-labelledby="people-heading" className="space-y-4">
        <h2 id="people-heading" className="text-lg font-semibold text-gray-800">
          People
        </h2>
        {renderTable(people, true, 'No people yet.')}
        <h3 className="text-sm font-semibold text-gray-900">Invite a member</h3>
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

      <section aria-labelledby="machines-heading" className="space-y-4">
        <h2 id="machines-heading" className="text-lg font-semibold text-gray-800">
          Machines
        </h2>
        {renderTable(machines, false, 'No machine users yet.')}
        <h3 className="text-sm font-semibold text-gray-900">Add a machine</h3>
        <form onSubmit={handleAddMachine} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="machine-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="machine-name"
              type="text"
              required
              maxLength={MAX_MACHINE_NAME_LENGTH}
              value={machineName}
              onChange={(e) => setMachineName(e.target.value)}
              className="mt-1 block w-64 rounded-md border-gray-300 shadow-xs text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="machine-description"
              className="block text-sm font-medium text-gray-700"
            >
              Description (optional)
            </label>
            <input
              id="machine-description"
              type="text"
              value={machineDescription}
              onChange={(e) => setMachineDescription(e.target.value)}
              className="mt-1 block w-64 rounded-md border-gray-300 shadow-xs text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={addingMachine}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {addingMachine ? 'Adding…' : 'Add machine'}
          </button>
        </form>
      </section>
    </div>
  )
}
