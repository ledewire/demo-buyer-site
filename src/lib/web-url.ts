/** Whether `value` is an http(s) URL: safe to link to or hand on, unlike `javascript:` or `data:`. */
export function isWebUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}
