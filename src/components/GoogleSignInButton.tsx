'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

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
  googleClientId: string
  onError: (message: string) => void
  onLoadingChange: (loading: boolean) => void
}

export default function GoogleSignInButton({ googleClientId, onError, onLoadingChange }: Props) {
  const router = useRouter()
  const btnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleCredential = async (response: { credential: string }) => {
      onLoadingChange(true)
      onError('')
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: response.credential }),
        })
        const data = await res.json()
        if (!res.ok) {
          onError(data.error ?? 'Google sign-in failed')
        } else {
          router.push('/dashboard')
        }
      } catch {
        onError('Network error — please try again')
      } finally {
        onLoadingChange(false)
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
      if (btnRef.current) {
        window.google?.accounts.id.renderButton(btnRef.current, {
          theme: 'outline-solid',
          size: 'large',
          width: 320,
        })
      }
    }
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [googleClientId, router, onError, onLoadingChange])

  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="relative w-full">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-gray-50 text-gray-500">or</span>
        </div>
      </div>
      <div ref={btnRef} />
    </div>
  )
}
