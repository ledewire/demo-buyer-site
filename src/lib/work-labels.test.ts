import { describe, it, expect } from 'vitest'
import { isPageKind, topicLabel } from './work-labels'

describe('topicLabel', () => {
  it('turns a slug into a sentence-case label', () => {
    expect(topicLabel('sports')).toBe('Sports')
    expect(topicLabel('books-and-literature')).toBe('Books and literature')
    expect(topicLabel('personal-celebrations-and-life-events')).toBe(
      'Personal celebrations and life events',
    )
  })
})

describe('isPageKind', () => {
  it('accepts the SDK page kinds and rejects anything else', () => {
    expect(isPageKind('section_index')).toBe(true)
    expect(isPageKind('blog')).toBe(false)
    expect(isPageKind('toString')).toBe(false)
  })
})
