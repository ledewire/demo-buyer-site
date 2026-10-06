'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CompanyMembership } from '@ledewire/node'

const TOKEN_PARAMS = ['token', 'invitation_token', 'company_invitation_token']

/**
 * Pulls the invitation token out of what was pasted: a bare token, or the
 * full link from the email carrying it as a query parameter.
 */
export function extractToken(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (!/^https?:\/\//i.test(value)) return value
  try {
    const params = new URL(value).searchParams
    for (const name of TOKEN_PARAMS) {
      const token = params.get(name)
      if (token) return token
    }
  } catch {
    // Not a parseable URL — fall through.
  }
  return null
}

interface Props {
  initialToken: string
}

export default function JoinCompanyForm({ initialToken }: Props) {
  const router = useRouter()
  const [input, setInput] = useState(initialToken)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState<CompanyMembership | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const token = extractToken(input)
    if (!token) {
      setError("Couldn't find a token in that link — paste the token itself.")
      return
    }
    setJoining(true)
    try {
      const res = await fetch('/api/company/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to accept the invitation')
      } else {
        setJoined(data)
        // Re-render the layout so the nav picks up the new membership.
        router.refresh()
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setJoining(false)
    }
  }

  if (joined) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-green-800">
          You joined {joined.company_name} as {joined.role === 'admin' ? 'an admin' : 'a member'}.
        </p>
        <a
          href={joined.role === 'admin' ? '/company/members' : '/wallet'}
          className="text-sm text-green-700 hover:text-green-900 underline"
        >
          {joined.role === 'admin' ? 'Manage members' : 'View the Company wallet'}
        </a>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-4"
    >
      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
        >
          {error}
        </p>
      )}
      <div>
        <label htmlFor="invitation" className="block text-sm font-medium text-gray-700">
          Invitation link or token
        </label>
        <input
          id="invitation"
          type="text"
          required
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={joining}
        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
      >
        {joining ? 'Joining…' : 'Join Company'}
      </button>
    </form>
  )
}
