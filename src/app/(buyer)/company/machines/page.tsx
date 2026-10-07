import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { getCompanyMembership } from '@/lib/company'
import { getCompanyActivity } from '@/lib/company-activity'
import { AuthError, LedewireError } from '@ledewire/node'
import CompanyTabs from '../CompanyTabs'
import NotInCompany from '../NotInCompany'
import MachinesManager from './MachinesManager'

export default async function CompanyMachinesPage() {
  await requireAuth()

  try {
    const membership = await getCompanyMembership()
    if (!membership) {
      return <NotInCompany />
    }
    if (membership.role !== 'admin') {
      return <p className="text-sm text-gray-500">Only Company admins can manage machines.</p>
    }

    const client = await createBuyerClient()
    const members = await client.company.members.list()
    const machines = members.data.filter((m) => m.kind === 'machine')
    const activity = await getCompanyActivity(machines.map((m) => m.id))
    return (
      <div className="space-y-6">
        <CompanyTabs current="machines" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Machines</h1>
          <p className="mt-1 text-sm text-gray-500">
            Machine users let software, such as an AI agent, spend from the{' '}
            {membership.company_name} wallet, up to their own daily spend cap.
          </p>
        </div>
        <MachinesManager
          initialMachines={machines}
          currentMembershipId={membership.id}
          activity={activity.members}
        />
      </div>
    )
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    if (err instanceof LedewireError) {
      return <p className="text-red-600 text-sm">API error: {err.message}</p>
    }
    throw err
  }
}
