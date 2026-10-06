import { cache } from 'react'
import { NotFoundError } from '@ledewire/node'
import type { CompanyMembership } from '@ledewire/node'
import { createBuyerClient } from './ledewire'

/**
 * Returns the signed-in buyer's Company membership, or null when they belong
 * to no Company. Memoised per request so the layout and page share one call.
 */
export const getCompanyMembership = cache(async (): Promise<CompanyMembership | null> => {
  try {
    const client = await createBuyerClient()
    return await client.company.membership.get()
  } catch (err) {
    if (err instanceof NotFoundError) return null
    throw err
  }
})
