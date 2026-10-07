import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/config', () => ({ config: { ledewireBaseUrl: 'https://api.ledewire.com' } }))
vi.mock('@ledewire/node', () => ({ createClient: vi.fn() }))
vi.mock('./SignupForm', () => ({
  default: (props: object) => <pre data-testid="form-props">{JSON.stringify(props)}</pre>,
}))

import { createClient } from '@ledewire/node'
import SignupPage from './page'

function formProps() {
  return JSON.parse(screen.getByTestId('form-props').textContent ?? '')
}

describe('SignupPage', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReturnValue({
      config: { getPublic: vi.fn().mockResolvedValue({ google_client_id: 'gid' }) },
    } as never)
  })

  it('passes the invitation tokens from the URL to the form', async () => {
    render(
      await SignupPage({
        searchParams: Promise.resolve({
          company_invitation_token: 'T',
          invitation_token: 'S',
          other: 'x',
        }),
      }),
    )
    expect(formProps()).toEqual({
      googleClientId: 'gid',
      invitationTokens: { company_invitation_token: 'T', invitation_token: 'S' },
    })
  })

  it('passes no tokens without them', async () => {
    render(await SignupPage({ searchParams: Promise.resolve({}) }))
    expect(formProps()).toEqual({ googleClientId: 'gid', invitationTokens: {} })
  })
})
