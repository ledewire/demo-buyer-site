import Link from 'next/link'
import LogoutButton from './LogoutButton'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/purchases', label: 'Purchases' },
  { href: '/api-keys', label: 'API Keys' },
]

export default function NavBar() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <span className="font-bold text-indigo-700 text-lg">LedeWire</span>
            <div className="hidden sm:flex space-x-6">
              {navLinks.map(({ href, label }) => (
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
