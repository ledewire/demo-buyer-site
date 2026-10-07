'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CompanyMember } from '@ledewire/node'
import type { MemberActivity } from '@/lib/company-activity'
import { MAX_MACHINE_NAME_LENGTH } from '@/lib/machine-users'
import MembersTable from '../members/MembersTable'

interface Props {
  /** The Company's Machine users. */
  initialMachines: CompanyMember[]
  /** The viewer's own membership id, marked "(you)" in the table. */
  currentMembershipId: string
  /** Each machine's recent spend by membership id; a machine missing from it has spent nothing. */
  activity: Record<string, MemberActivity>
}

/** The Company's Machine users, and the form to add one. */
export default function MachinesManager({ initialMachines, currentMembershipId, activity }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [machineName, setMachineName] = useState('')
  const [machineDescription, setMachineDescription] = useState('')
  const [addingMachine, setAddingMachine] = useState(false)

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

  return (
    <div className="space-y-8">
      <MembersTable
        initialMembers={initialMachines}
        showRole={false}
        emptyMessage="No machine users yet."
        currentMembershipId={currentMembershipId}
        activity={activity}
      />

      <section aria-labelledby="add-machine-heading" className="space-y-4">
        <h2 id="add-machine-heading" className="text-lg font-semibold text-gray-800">
          Add a machine
        </h2>
        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
          >
            {error}
          </p>
        )}
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
