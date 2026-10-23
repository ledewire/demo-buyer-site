import { NextResponse } from 'next/server'
import { AuthError, LedewireError, SpendCapReachedError } from '@ledewire/node'

/**
 * Maps an error thrown by a @ledewire/node call to a JSON Route Handler
 * response. `tag` prefixes the log line for unexpected errors.
 */
export function ledewireErrorResponse(err: unknown, tag: string): NextResponse {
  if (err instanceof AuthError)
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (err instanceof SpendCapReachedError)
    return NextResponse.json(
      { error: err.message, type: 'daily_spend_cap_reached', resets_at: err.resetsAt },
      { status: 402 },
    )
  if (err instanceof LedewireError) {
    // A rate limit says when to try again; pass that on so the browser can count down.
    const headers =
      err.retryAfter === undefined ? undefined : { 'Retry-After': String(err.retryAfter) }
    return NextResponse.json(
      { error: err.message, type: err.type },
      { status: err.statusCode, headers },
    )
  }
  console.error(`[${tag}] unexpected error`, err)
  return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
}
