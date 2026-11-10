import type { PublicationWork, TopicSlug } from '@ledewire/node'

export type PageKind = PublicationWork['page_kind']

/**
 * Every Page kind the SDK knows, with its label. Typed against the SDK's union, so
 * a kind added in an SDK upgrade fails typecheck here rather than being rejected
 * at runtime as unknown.
 */
export const PAGE_KIND_LABELS = {
  article: 'Article',
  section_index: 'Section index',
  homepage: 'Homepage',
  media: 'Media',
  utility: 'Utility',
  unclassified: 'Unclassified',
} as const satisfies Record<PageKind, string>

export function isPageKind(value: string): value is PageKind {
  return Object.hasOwn(PAGE_KIND_LABELS, value)
}

/** A Topic slug as a sentence-case label: `books-and-literature` → "Books and literature". */
export function topicLabel(slug: string): string {
  const words = slug.replaceAll('-', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Every Topic slug the SDK knows. Typed against the SDK's union, so a Topic added in
 * an SDK upgrade fails typecheck here rather than being dropped from the catalog's
 * topic filter.
 */
const TOPIC_SLUG_SET = {
  attractions: true,
  automotive: true,
  'books-and-literature': true,
  'business-and-finance': true,
  careers: true,
  communication: true,
  crime: true,
  disasters: true,
  education: true,
  entertainment: true,
  events: true,
  'family-and-relationships': true,
  'fine-art': true,
  'food-and-drink': true,
  'healthy-living': true,
  'hobbies-and-interests': true,
  holidays: true,
  'home-and-garden': true,
  law: true,
  'medical-health': true,
  'personal-celebrations-and-life-events': true,
  'personal-finance': true,
  pets: true,
  politics: true,
  'pop-culture': true,
  'real-estate': true,
  'religion-and-spirituality': true,
  science: true,
  shopping: true,
  sports: true,
  'style-and-fashion': true,
  'technology-and-computing': true,
  travel: true,
  'video-gaming': true,
  'war-and-conflicts': true,
} as const satisfies Record<TopicSlug, true>

/** Every Topic slug, in the API's vocabulary order. */
export const TOPIC_SLUGS = Object.keys(TOPIC_SLUG_SET) as TopicSlug[]

export function isTopicSlug(value: string): value is TopicSlug {
  return Object.hasOwn(TOPIC_SLUG_SET, value)
}
