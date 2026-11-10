import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { renderFetchError } from '@/lib/page-errors'
import { getCompanyMembership } from '@/lib/company'
import { getCompanyActivity } from '@/lib/company-activity'
import CompanyTabs from '../CompanyTabs'
import NotInCompany from '../NotInCompany'
import PeopleManager from './PeopleManager'

async function loadPeople() {
  const client = await createBuyerClient()
  const [members, invitations] = await Promise.all([
    client.company.members.list(),
    client.company.invitations.list(),
  ])
  const people = members.data.filter((m) => m.kind === 'human')
  const activity = await getCompanyActivity(people.map((m) => m.id))
  return { people, invitations, activity }
}

export default async function CompanyMembersPage() {
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
    return <p className="text-sm text-gray-500">Only Company admins can manage members.</p>
  }

  let data: Awaited<ReturnType<typeof loadPeople>>
  try {
    data = await loadPeople()
  } catch (err) {
    return renderFetchError(err)
  }
  const { people, invitations, activity } = data

  return (
    <div className="space-y-6">
      <CompanyTabs current="people" />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <p className="mt-1 text-sm text-gray-500">
          Everyone in {membership.company_name} spends from the Company wallet, up to their own
          daily spend cap.
        </p>
      </div>
      <PeopleManager
        initialPeople={people}
        initialInvitations={invitations.data}
        currentMembershipId={membership.id}
        activity={activity.members}
      />
    </div>
  )
}
