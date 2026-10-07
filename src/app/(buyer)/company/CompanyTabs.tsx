import Link from 'next/link'

const tabs = [
  { key: 'people', href: '/company/members', label: 'People' },
  { key: 'purchases', href: '/company/purchases', label: 'Purchases' },
] as const

export type CompanyTab = (typeof tabs)[number]['key']

/** The tab bar shared by the Company admin pages. Render it only on an admin's view. */
export default function CompanyTabs({ current }: { current: CompanyTab }) {
  return (
    <nav aria-label="Company" className="border-b border-gray-200">
      <ul className="-mb-px flex space-x-6">
        {tabs.map(({ key, href, label }) => {
          const isCurrent = key === current
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={isCurrent ? 'page' : undefined}
                className={`inline-block border-b-2 px-1 pb-3 text-sm font-medium ${
                  isCurrent
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
