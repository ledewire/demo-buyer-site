import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/config', () => ({ config: { ledewireBaseUrl: 'https://api.ledewire.com' } }))
vi.mock('@ledewire/node', () => ({ createClient: vi.fn() }))
vi.mock('./LoginForm', () => ({
  default: (props: object) => <pre data-testid="form-props">{JSON.stringify(props)}</pre>,
}))

import { createClient } from '@ledewire/node'
import LoginPage from './page'

function formProps() {
  return JSON.parse(screen.getByTestId('form-props').textContent ?? '')
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReturnValue({
      config: { getPublic: vi.fn().mockResolvedValue({ google_client_id: 'gid' }) },
    } as never)
  })

  it('passes invitation tokens carried from the signup link to the form', async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ company_invitation_token: 'T', other: 'x' }),
      }),
    )
    expect(formProps()).toEqual({
      googleClientId: 'gid',
      invitationTokens: { company_invitation_token: 'T' },
    })
  })

  it('passes no tokens without them', async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }))
    expect(formProps()).toEqual({ googleClientId: 'gid', invitationTokens: {} })
  })
})
