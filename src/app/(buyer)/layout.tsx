import NavBar from '@/components/NavBar'
import { getCompanyMembership } from '@/lib/company'

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  // The nav is chrome — a failed membership lookup must not take down the page.
  const membership = await getCompanyMembership().catch((err) => {
    console.error('[layout] Company membership lookup failed', err)
    return null
  })
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar isCompanyAdmin={membership?.role === 'admin'} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
