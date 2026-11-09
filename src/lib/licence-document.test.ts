import { describe, it, expect } from 'vitest'
import { isPurchaseId, licenceFilename } from './licence-document'

describe('isPurchaseId', () => {
  it.each(['p-1', 'abc_DEF-123', '0f8fad5b-d9cb-469f-a165-70867728950e'])('accepts %s', (id) => {
    expect(isPurchaseId(id)).toBe(true)
  })

  it.each(['', '..', '../x', 'a/b', 'a%2Fb', 'a.b', 'a b', 'a\r\nb', 'p-1?x=1'])(
    'rejects %j',
    (id) => {
      expect(isPurchaseId(id)).toBe(false)
    },
  )
})

describe('licenceFilename', () => {
  it.each([
    ['application/pdf', 'licence-p-1.pdf'],
    ['text/markdown; charset=utf-8', 'licence-p-1.md'],
    ['TEXT/MARKDOWN', 'licence-p-1.md'],
    ['text/plain', 'licence-p-1.txt'],
    ['application/octet-stream', 'licence-p-1.bin'],
    ['', 'licence-p-1.bin'],
  ])('names a %j document %s', (contentType, expected) => {
    expect(licenceFilename('p-1', contentType)).toBe(expected)
  })
})
