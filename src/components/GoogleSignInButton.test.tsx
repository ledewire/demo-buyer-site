import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { fullPageNavigate } from '@/lib/navigation'
import GoogleSignInButton from './GoogleSignInButton'

vi.mock('@/lib/navigation', () => ({ fullPageNavigate: vi.fn() }))

// Simulate the GSI script loading and invoking the credential callback
function simulateGoogleCredential(credential: string) {
  const script = document.querySelector('script[src*="gsi/client"]') as HTMLScriptElement
  // Trigger onload manually
  script?.dispatchEvent(new Event('load'))
  // Invoke the callback registered with google.accounts.id.initialize
  const init = window.google?.accounts.id.initialize as ReturnType<typeof vi.fn>
  const callback = init?.mock.calls.at(-1)?.[0]?.callback
  callback?.({ credential })
}

describe('GoogleSignInButton', () => {
  const onError = vi.fn()
  const onLoadingChange = vi.fn()

  afterEach(() => {
    document.querySelectorAll('script[src*="gsi/client"]').forEach((s) => s.remove())
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fullPageNavigate).mockReset()

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
    await waitFor(() => expect(fullPageNavigate).toHaveBeenCalledWith('/dashboard'))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/google',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id_token: 'id_token_123' }),
      }),
    )
  })

  it('stays busy while the next page loads', async () => {
    render(
      <GoogleSignInButton
        googleClientId="gid_test"
        onError={onError}
        onLoadingChange={onLoadingChange}
      />,
    )
    simulateGoogleCredential('id_token_123')
    await waitFor(() => expect(fullPageNavigate).toHaveBeenCalled())
    expect(onLoadingChange).toHaveBeenCalledWith(true)
    expect(onLoadingChange).not.toHaveBeenCalledWith(false)
  })

  it('sends the invitation tokens with the credential', async () => {
    render(
      <GoogleSignInButton
        googleClientId="gid_test"
        invitationTokens={{ company_invitation_token: 'T', invitation_token: 'S' }}
        onError={onError}
        onLoadingChange={onLoadingChange}
      />,
    )
    simulateGoogleCredential('id_token_123')
    await waitFor(() => expect(fullPageNavigate).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/google',
      expect.objectContaining({
        body: JSON.stringify({
          id_token: 'id_token_123',
          company_invitation_token: 'T',
          invitation_token: 'S',
        }),
      }),
    )
  })

  it('goes where the API says after joining a Company', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, redirect: '/company/members' }),
    } as Response)
    render(
      <GoogleSignInButton
        googleClientId="gid_test"
        invitationTokens={{ company_invitation_token: 'T' }}
        onError={onError}
        onLoadingChange={onLoadingChange}
      />,
    )
    simulateGoogleCredential('id_token_123')
    await waitFor(() => expect(fullPageNavigate).toHaveBeenCalledWith('/company/members'))
  })

  it('shows a refused invitation and stays put', async () => {
    const error = 'This invitation has expired. Ask your Company admin to send a new one.'
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error, type: 'invitation_not_accepted', reason: 'expired' }),
    } as Response)
    render(
      <GoogleSignInButton
        googleClientId="gid_test"
        invitationTokens={{ company_invitation_token: 'T' }}
        onError={onError}
        onLoadingChange={onLoadingChange}
      />,
    )
    simulateGoogleCredential('id_token_123')
    await waitFor(() => expect(onError).toHaveBeenCalledWith(error))
    expect(fullPageNavigate).not.toHaveBeenCalled()
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
    expect(fullPageNavigate).not.toHaveBeenCalled()
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

  it('loads Google once however often the button mounts', async () => {
    const button = (
      <GoogleSignInButton
        googleClientId="gid_test"
        onError={onError}
        onLoadingChange={onLoadingChange}
      />
    )
    const first = render(button)
    document.querySelector('script[src*="gsi/client"]')?.dispatchEvent(new Event('load'))
    first.unmount()
    render(button)
    simulateGoogleCredential('id_token_123')
    expect(document.querySelectorAll('script[src*="gsi/client"]')).toHaveLength(1)
    expect(window.google?.accounts.id.initialize).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(fullPageNavigate).toHaveBeenCalledWith('/dashboard'))
  })
})
