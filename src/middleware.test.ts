import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

function visit(path: string, cookie?: string) {
  return middleware(
    new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined),
  )
}

describe('middleware', () => {
  it('sends a signed-out buyer to sign-in from a protected page', () => {
    const res = visit('/company/members')
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/login')
  })

  it('lets a signed-in buyer through', () => {
    expect(visit('/company/members', 'lw_buyer_session=x').headers.get('location')).toBeNull()
  })

  it('lets a signed-out invitee reach the invitation link, which carries its token to sign-in', () => {
    expect(visit('/company/invitations/accept?token=T').headers.get('location')).toBeNull()
  })
})
