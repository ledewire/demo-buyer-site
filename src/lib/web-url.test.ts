import { describe, it, expect } from 'vitest'
import { isWebUrl } from './web-url'

describe('isWebUrl', () => {
  it.each(['https://example.com/a', 'http://example.com'])('accepts %s', (v) => {
    expect(isWebUrl(v)).toBe(true)
  })

  it.each(['javascript:alert(1)', 'data:text/html,x', 'ftp://example.com', 'not a url', '', 42])(
    'refuses %j',
    (v) => {
      expect(isWebUrl(v)).toBe(false)
    },
  )
})
