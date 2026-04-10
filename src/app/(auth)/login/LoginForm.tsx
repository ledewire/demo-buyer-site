'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void
          renderButton: (element: HTMLElement, config: object) => void
        }
      }
    }
  }
}

interface Props {
  googleClientId: string | null
}

export default function LoginForm({ googleClientId }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const googleBtnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!googleClientId) return
    const handleCredential = async (response: { credential: string }) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: response.credential }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Google sign-in failed')
        } else {
          router.push('/dashboard')
        }
      } catch {
        setError('Network error — please try again')
      } finally {
        setLoading(false)
      }
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredential,
      })
      if (googleBtnRef.current) {
        window.google?.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
        })
      }
    }
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [googleClientId, router])

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
        router.push('/dashboard')
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
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Sign in to LedeWire</h1>
          <p className="mt-1 text-sm text-gray-500">Buyer portal</p>
        </div>
        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {googleClientId && (
          <div className="flex flex-col items-center space-y-3">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">or</span>
              </div>
            </div>
            <div ref={googleBtnRef} id="google-signin-btn" />
          </div>
        )}
        <div className="flex justify-between text-sm text-gray-600">
          <Link href="/signup" className="hover:text-gray-900">
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
