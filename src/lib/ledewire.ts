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
        await session.destroy()
      } catch {
        session.accessToken = undefined
        session.refreshToken = undefined
        session.expiresAt = undefined
      }
    },
  }

  return createClient({ baseUrl: config.ledewireBaseUrl, storage })
}
