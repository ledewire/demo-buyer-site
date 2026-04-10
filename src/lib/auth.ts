import { redirect } from 'next/navigation'
import { getSession } from './session'

/**
 * Guards a Server Component or Server Action.
 * Redirects unauthenticated buyers to /login.
 */
export async function requireAuth(): Promise<void> {
  const session = await getSession()
  if (!session.accessToken) {
    redirect('/login')
  }
}
