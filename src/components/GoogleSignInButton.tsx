'use client'

import { useEffect, useRef } from 'react'
import type { InvitationTokens } from '@/lib/invitations'
import { fullPageNavigate } from '@/lib/navigation'

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

const GSI_SRC = 'https://accounts.google.com/gsi/client'

type CredentialHandler = (response: { credential: string }) => void

// Google warns when initialized twice, so the page initializes it once and
// routes each credential to whichever button is mounted now.
let credentialHandler: CredentialHandler | null = null
const initializedFor = new WeakMap<object, string>()

/** Runs `onLoad` once the GSI library is loaded, adding its script only if missing. */
function whenGsiLoaded(onLoad: () => void): () => void {
  let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
  if (script && window.google) {
    onLoad()
    return () => {}
  }
  if (!script) {
    script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }
  const loading = script
  loading.addEventListener('load', onLoad)
  return () => loading.removeEventListener('load', onLoad)
}

interface Props {
  googleClientId: string
  /** Invitation tokens from the email link, accepted as the buyer signs in. */
  invitationTokens?: InvitationTokens
  onError: (message: string) => void
  onLoadingChange: (loading: boolean) => void
}

export default function GoogleSignInButton({
  googleClientId,
  invitationTokens,
  onError,
  onLoadingChange,
}: Props) {
  const btnRef = useRef<HTMLDivElement>(null)
  // Primitives, so a fresh tokens object each render doesn't re-render the button.
  const companyInvitationToken = invitationTokens?.company_invitation_token
  const storeInvitationToken = invitationTokens?.invitation_token

  useEffect(() => {
    const handleCredential: CredentialHandler = async (response) => {
      onLoadingChange(true)
      onError('')
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_token: response.credential,
            company_invitation_token: companyInvitationToken,
            invitation_token: storeInvitationToken,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          onError(data.error ?? 'Google sign-in failed')
        } else {
          fullPageNavigate(data.redirect ?? '/dashboard')
        }
      } catch {
        onError('Network error — please try again')
      } finally {
        onLoadingChange(false)
      }
    }

    credentialHandler = handleCredential
    const stopWaiting = whenGsiLoaded(() => {
      const gsi = window.google?.accounts.id
      if (!gsi) return
      if (initializedFor.get(gsi) !== googleClientId) {
        gsi.initialize({
          client_id: googleClientId,
          callback: (response: { credential: string }) => credentialHandler?.(response),
        })
        initializedFor.set(gsi, googleClientId)
      }
      if (btnRef.current) {
        gsi.renderButton(btnRef.current, {
          theme: 'outline-solid',
          size: 'large',
          width: 320,
        })
      }
    })
    return () => {
      stopWaiting()
      if (credentialHandler === handleCredential) credentialHandler = null
    }
  }, [googleClientId, companyInvitationToken, storeInvitationToken, onError, onLoadingChange])

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
