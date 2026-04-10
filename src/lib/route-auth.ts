import { NextResponse } from 'next/server'
import { getSession } from './session'

/**
 * Guards a Route Handler.
 * Returns an empty object when authenticated, or a 401 NextResponse when not.
 */
export async function requireAuthForRoute(): Promise<Record<string, never> | NextResponse> {
  const session = await getSession()
  if (!session.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  return {}
}
