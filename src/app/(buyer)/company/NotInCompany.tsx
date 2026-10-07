import Link from 'next/link'

/** What a Company page shows a buyer who belongs to no Company. */
export default function NotInCompany() {
  return (
    <p className="text-sm text-gray-500">
      You&apos;re not part of a Company. Have an invitation?{' '}
      <Link href="/join" className="text-indigo-600 hover:text-indigo-800">
        Join a Company
      </Link>
    </p>
  )
}
