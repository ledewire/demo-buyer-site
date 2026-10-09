import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Reachable signed out: it carries the invitation token to sign-in itself,
// which a redirect from here would drop (#45).
const PUBLIC_PATHS = new Set(['/company/invitations/accept'])

export function middleware(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) return NextResponse.next()
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
