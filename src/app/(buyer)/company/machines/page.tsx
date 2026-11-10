import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { renderFetchError } from '@/lib/page-errors'
import { getCompanyMembership } from '@/lib/company'
import { getCompanyActivity } from '@/lib/company-activity'
import CompanyTabs from '../CompanyTabs'
import NotInCompany from '../NotInCompany'
import MachinesManager from './MachinesManager'

async function loadMachines() {
  const client = await createBuyerClient()
  const members = await client.company.members.list()
  const machines = members.data.filter((m) => m.kind === 'machine')
  const activity = await getCompanyActivity(machines.map((m) => m.id))
  return { machines, activity }
}

export default async function CompanyMachinesPage() {
  await requireAuth()

  let membership: Awaited<ReturnType<typeof getCompanyMembership>>
  try {
    membership = await getCompanyMembership()
  } catch (err) {
    return renderFetchError(err)
  }
  if (!membership) {
    return <NotInCompany />
  }
  if (membership.role !== 'admin') {
    return <p className="text-sm text-gray-500">Only Company admins can manage machines.</p>
  }

  let data: Awaited<ReturnType<typeof loadMachines>>
  try {
    data = await loadMachines()
  } catch (err) {
    return renderFetchError(err)
  }
  const { machines, activity } = data

  return (
    <div className="space-y-6">
      <CompanyTabs current="machines" />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Machines</h1>
        <p className="mt-1 text-sm text-gray-500">
          Machine users let software, such as an AI agent, spend from the {membership.company_name}{' '}
          wallet, up to their own daily spend cap.
        </p>
      </div>
      <MachinesManager
        initialMachines={machines}
        currentMembershipId={membership.id}
        activity={activity.members}
      />
    </div>
  )
}
