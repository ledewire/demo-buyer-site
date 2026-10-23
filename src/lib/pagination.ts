/** A positive integer page number from the URL; anything else is page 1. */
export function parsePage(value: string | undefined): number {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}
