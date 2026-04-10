import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import GoogleSignInButton from './GoogleSignInButton'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

// Simulate the GSI script loading and invoking the credential callback
function simulateGoogleCredential(credential: string) {
  const script = document.querySelector('script[src*="gsi/client"]') as HTMLScriptElement
  // Trigger onload manually
  script?.dispatchEvent(new Event('load'))
  // Invoke the callback registered with google.accounts.id.initialize
  const init = window.google?.accounts.id.initialize as ReturnType<typeof vi.fn>
  const callback = init?.mock.calls[0]?.[0]?.callback
  callback?.({ credential })
}

describe('GoogleSignInButton', () => {
  const onError = vi.fn()
  const onLoadingChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockPush.mockReset()

    // Stub the Google GSI API
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn(),
          renderButton: vi.fn(),
        },
      },
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response)
  })

  it('appends the GSI script to document.head', () => {
    render(
      <GoogleSignInButton
        googleClientId="gid_test"
        onError={onError}
        onLoadingChange={onLoadingChange}
      />,
    )
    expect(
      document.querySelector('script[src="https://accounts.google.com/gsi/client"]'),
    ).toBeTruthy()
  })

  it('calls google.accounts.id.initialize with the clientId on script load', () => {
    render(
      <GoogleSignInButton
        googleClientId="gid_test"
        onError={onError}
        onLoadingChange={onLoadingChange}
      />,
    )
    simulateGoogleCredential('tok_unused')
    expect(window.google?.accounts.id.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'gid_test' }),
    )
  })

  it('calls the API and redirects on successful credential', async () => {
    render(
      <GoogleSignInButton
        googleClientId="gid_test"
        onError={onError}
        onLoadingChange={onLoadingChange}
      />,
    )
    simulateGoogleCredential('id_token_123')
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/google',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('calls onError when the API returns an error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Google sign-in failed' }),
    } as Response)
    render(
      <GoogleSignInButton
        googleClientId="gid_test"
        onError={onError}
        onLoadingChange={onLoadingChange}
      />,
    )
    simulateGoogleCredential('bad_token')
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Google sign-in failed'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('calls onError on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'))
    render(
      <GoogleSignInButton
        googleClientId="gid_test"
        onError={onError}
        onLoadingChange={onLoadingChange}
      />,
    )
    simulateGoogleCredential('tok')
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Network error — please try again'))
  })

  it('removes the script on unmount', () => {
    const { unmount } = render(
      <GoogleSignInButton
        googleClientId="gid_test"
        onError={onError}
        onLoadingChange={onLoadingChange}
      />,
    )
    expect(document.querySelector('script[src*="gsi/client"]')).toBeTruthy()
    unmount()
    expect(document.querySelector('script[src*="gsi/client"]')).toBeNull()
  })
})
