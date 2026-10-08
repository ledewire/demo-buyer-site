/**
 * Navigates with a full document load, discarding the client Router Cache.
 * Use it whenever the signed-in identity changes, so no page rendered for the
 * previous session survives into the next one.
 */
export function fullPageNavigate(url: string): void {
  window.location.assign(url)
}
