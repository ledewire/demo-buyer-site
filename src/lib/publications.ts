import { cache } from 'react'
import type { Publication } from '@ledewire/node'
import { createBuyerClient } from './ledewire'

/** Upper bound on catalog pages walked, so a runaway catalog can't stall a render. */
const MAX_PAGES = 20

/**
 * Walks every page of the public publications catalog. The API has no search
 * parameter, so callers filter the full list. Memoised per request.
 */
export const getAllPublications = cache(async (): Promise<Publication[]> => {
  const client = await createBuyerClient()
  const all: Publication[] = []
  let page: number | null | undefined = 1
  for (let i = 0; page && i < MAX_PAGES; i++) {
    const { data, pagination }: Awaited<ReturnType<typeof client.publications.list>> =
      await client.publications.list({ page, per_page: 100 })
    all.push(...data)
    page = pagination.next_page
  }
  return all
})

/** Case-insensitive match on a publication's name or any of its domains. */
export function filterPublications(
  publications: Publication[],
  query: string,
  licensableOnly = false,
): Publication[] {
  const q = query.trim().toLowerCase()
  return publications.filter(
    (p) =>
      (!licensableOnly || p.bulk_licensable) &&
      (!q ||
        p.name.toLowerCase().includes(q) ||
        p.domains.some((d) => d.toLowerCase().includes(q))),
  )
}
