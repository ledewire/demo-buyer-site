'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import GoogleSignInButton from '@/components/GoogleSignInButton'
import { withInvitationTokens, type InvitationTokens } from '@/lib/invitations'
import { fullPageNavigate } from '@/lib/navigation'

interface Props {
  googleClientId: string | null
  /** Invitation tokens carried over from the signup link. */
  invitationTokens?: InvitationTokens
}

export default function LoginForm({ googleClientId, invitationTokens = {} }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGoogleError = useCallback((msg: string) => setError(msg || null), [])
  const handleGoogleLoading = useCallback((val: boolean) => setLoading(val), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
      } else {
        // Password sign-in can't carry an invitation, so finish it on /join.
        const companyToken = invitationTokens.company_invitation_token
        fullPageNavigate(
          companyToken ? `/join?${new URLSearchParams({ token: companyToken })}` : '/dashboard',
        )
        // Stay busy: the next page replaces this one.
        return
      }
    } catch {
      setError('Network error — please try again')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Sign in to LedeWire</h1>
          <p className="mt-1 text-sm text-gray-500">Buyer portal</p>
        </div>
        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
          >
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {googleClientId && (
          <GoogleSignInButton
            googleClientId={googleClientId}
            invitationTokens={invitationTokens}
            onError={handleGoogleError}
            onLoadingChange={handleGoogleLoading}
          />
        )}
        <div className="flex justify-between text-sm text-gray-600">
          <Link
            href={withInvitationTokens('/signup', invitationTokens)}
            className="hover:text-gray-900"
          >
            Create an account
          </Link>
          <Link href="/forgot-password" className="hover:text-gray-900">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  )
}
