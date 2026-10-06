'use client'

import { useState } from 'react'
import Link from 'next/link'

type Step = 'request' | 'confirm' | 'done'

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Request failed')
      } else {
        setStep('confirm')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', email, reset_code: code, password: newPassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Reset failed')
      } else {
        setStep('done')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 text-center">Reset password</h1>
        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
          >
            {error}
          </p>
        )}
        {step === 'request' && (
          <form onSubmit={handleRequest} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send reset code'}
            </button>
          </form>
        )}
        {step === 'confirm' && (
          <form onSubmit={handleConfirm} className="space-y-4">
            <p className="text-sm text-gray-600">
              A 6-digit code was sent to <strong>{email}</strong>.
            </p>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                Reset code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        )}
        {step === 'done' && (
          <div className="text-center space-y-3">
            <p className="text-green-600 font-medium">Password reset successfully!</p>
            <Link href="/login" className="text-indigo-600 hover:text-indigo-500 text-sm">
              Sign in with your new password
            </Link>
          </div>
        )}
        <p className="text-center text-sm">
          <Link href="/login" className="text-gray-600 hover:text-gray-900">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
