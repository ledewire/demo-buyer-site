/**
 * A purchase id as the API issues it: letters, digits, `-` and `_` only. Anything else
 * (a `/`, a `.`, an encoded separator, a CR/LF) is refused before it reaches an upstream
 * path or a response header.
 */
export function isPlainId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id)
}

const EXTENSIONS: [prefix: string, ext: string][] = [
  ['application/pdf', 'pdf'],
  ['text/markdown', 'md'],
  ['text/plain', 'txt'],
]

/** The download filename for a purchase's licence document, by its `Content-Type`. */
export function licenceFilename(purchaseId: string, contentType: string): string {
  const type = contentType.toLowerCase()
  const ext = EXTENSIONS.find(([prefix]) => type.startsWith(prefix))?.[1] ?? 'bin'
  return `licence-${purchaseId}.${ext}`
}
