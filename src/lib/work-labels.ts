import type { PublicationWork } from '@ledewire/node'

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
