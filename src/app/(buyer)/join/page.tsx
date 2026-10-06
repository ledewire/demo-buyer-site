import { requireAuth } from '@/lib/auth'
import JoinCompanyForm from './JoinCompanyForm'

export default async function JoinCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  await requireAuth()
  const { token } = await searchParams
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Join a Company</h1>
        <p className="mt-1 text-sm text-gray-500">
          Paste the link or token from your Company invitation email. Once you join, your purchases
          are paid from the Company wallet.
        </p>
      </div>
      <JoinCompanyForm initialToken={typeof token === 'string' ? token : ''} />
    </div>
  )
}
