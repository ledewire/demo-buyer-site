import type { ReactElement } from 'react'
import { redirect } from 'next/navigation'
import { AuthError, LedewireError } from '@ledewire/node'

/**
 * What a Server Component page shows when its data fetch fails: a signed-out Buyer goes to
 * `/login`, an API refusal shows its message, and anything else is rethrown.
 *
 * Call it from the `catch` around the fetch and render the page after the `try`, never
 * inside it (react-hooks/error-boundaries).
 */
export function renderFetchError(err: unknown): ReactElement {
  if (err instanceof AuthError) redirect('/login')
  if (err instanceof LedewireError) {
    return <p className="text-red-600 text-sm">API error: {err.message}</p>
  }
  throw err
}
