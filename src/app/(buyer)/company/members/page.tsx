import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { getCompanyMembership } from '@/lib/company'
import { AuthError, LedewireError } from '@ledewire/node'
import MembersManager from './MembersManager'

export default async function CompanyMembersPage() {
  await requireAuth()

  try {
    const membership = await getCompanyMembership()
    if (!membership) {
      return <p className="text-sm text-gray-500">You&apos;re not part of a Company.</p>
    }
    if (membership.role !== 'admin') {
      return <p className="text-sm text-gray-500">Only Company admins can manage members.</p>
    }

    const client = await createBuyerClient()
    const [members, invitations] = await Promise.all([
      client.company.members.list(),
      client.company.invitations.list(),
    ])
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="mt-1 text-sm text-gray-500">
            Everyone in {membership.company_name} spends from the Company wallet, up to their own
            daily spend cap.
          </p>
        </div>
        <MembersManager
          initialMembers={members.data}
          initialInvitations={invitations.data}
          currentMembershipId={membership.id}
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
