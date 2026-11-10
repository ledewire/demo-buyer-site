import { createClient } from '@ledewire/node'
import type { TokenStorage, StoredTokens } from '@ledewire/node'
import { getSession } from './session'
import { config } from './config'

/**
 * Creates a @ledewire/node client authenticated via the stored buyer session.
 *
 * Tokens are persisted back into the httpOnly session cookie automatically
 * on every background refresh, preventing token loss across requests.
 */
export async function createBuyerClient() {
  const session = await getSession()

  const storage: TokenStorage = {
    async getTokens(): Promise<StoredTokens | null> {
      if (!session.accessToken) return null
      return {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? '',
        expiresAt: session.expiresAt ?? 0,
      }
    },
    async setTokens(tokens: StoredTokens): Promise<void> {
      session.accessToken = tokens.accessToken
      session.refreshToken = tokens.refreshToken
      session.expiresAt = tokens.expiresAt
      await session.save()
    },
    async clearTokens(): Promise<void> {
      try {
        session.destroy()
      } catch {
        // destroy() empties the session before writing the cookie, so a read-only cookie
        // store (a Server Component) still leaves this request signed out. Writing the
        // fields back here would make a later save() on this request-cached session throw.
      }
    },
  }

  return createClient({ baseUrl: config.ledewireBaseUrl, storage })
}

/** The client `createBuyerClient()` returns. */
export type BuyerClient = Awaited<ReturnType<typeof createBuyerClient>>
