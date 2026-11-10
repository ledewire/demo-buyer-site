import { describe, it, expect } from 'vitest'
import { isPageKind, isTopicSlug, topicLabel } from './work-labels'

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

describe('isTopicSlug', () => {
  it('accepts the SDK topic slugs and rejects anything else', () => {
    expect(isTopicSlug('sports')).toBe(true)
    expect(isTopicSlug('personal-celebrations-and-life-events')).toBe(true)
    expect(isTopicSlug('Sports')).toBe(false)
    expect(isTopicSlug('gardening')).toBe(false)
    expect(isTopicSlug('toString')).toBe(false)
  })
})
