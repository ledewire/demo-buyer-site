import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { config, proxy } from './proxy'

function visit(path: string, cookie?: string) {
  return proxy(
    new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined),
  )
}

describe('proxy', () => {
  it('sends a signed-out buyer to sign-in from a protected page', () => {
    const res = visit('/company/members')
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get('location') ?? '')
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('from')).toBe('/company/members')
  })

  it('guards Search: the matcher runs the proxy on /search', () => {
    expect(config.matcher).toContain('/search/:path*')
  })

  it('lets a signed-in buyer through', () => {
    expect(visit('/company/members', 'lw_buyer_session=x').headers.get('location')).toBeNull()
  })

  it('lets a signed-out invitee reach the invitation link, which carries its token to sign-in', () => {
    expect(visit('/company/invitations/accept?token=T').headers.get('location')).toBeNull()
  })
})
