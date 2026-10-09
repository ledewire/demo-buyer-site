import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// The existing account's invitation link. Reachable signed out: it carries the
// token to sign-in itself, which a redirect from here would drop (#45).
const INVITATION_LINK_PATH = '/company/invitations/accept'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === INVITATION_LINK_PATH) return NextResponse.next()
  const session = request.cookies.get('lw_buyer_session')
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/wallet/:path*',
    '/purchases/:path*',
    '/api-keys/:path*',
    '/catalog/:path*',
    '/exports/:path*',
    '/company/:path*',
    '/join/:path*',
  ],
}
