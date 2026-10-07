import Link from 'next/link'
import LogoutButton from './LogoutButton'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/purchases', label: 'Purchases' },
  { href: '/catalog', label: 'Catalog' },
  { href: '/exports', label: 'Exports' },
  { href: '/api-keys', label: 'API Keys' },
]

// The Company pages share a tab bar of their own; the nav only needs a way in.
const companyAdminLink = { href: '/company/members', label: 'Company' }

interface Props {
  /** Shows the Company link when true. */
  isCompanyAdmin?: boolean
}

export default function NavBar({ isCompanyAdmin = false }: Props) {
  const links = isCompanyAdmin ? [...navLinks, companyAdminLink] : navLinks
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <span className="font-bold text-indigo-700 text-lg">LedeWire</span>
            <div className="hidden sm:flex space-x-6">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <LogoutButton />
        </div>
      </div>
    </nav>
  )
}
