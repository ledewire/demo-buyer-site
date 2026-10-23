import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ContentSearchResultWithPublication } from '@ledewire/node'
import ExportSelectionSummary from '@/components/ExportSelectionSummary'
import type { Delivery } from '@/lib/purchase-delivery'
import { makeResult } from '@/test/search-fixtures'
import ArticleView from './ArticleView'

function renderArticle(
  delivery: Delivery,
  result: ContentSearchResultWithPublication = makeResult(),
) {
  const onBack = vi.fn()
  const view = render(<ArticleView work={{ result, delivery }} onBack={onBack} />)
  return { ...view, onBack }
}

describe('ArticleView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  describe('the delivered body', () => {
    it('renders markdown, dropping raw HTML', () => {
      const { container } = renderArticle({
        content_type: 'markdown',
        content_body:
          '## Warming seas\n\nThe **sea** is hot.\n\n<script>alert(1)</script><b>raw</b>',
      })
      expect(screen.getByRole('heading', { name: 'Warming seas' })).toBeInTheDocument()
      expect(screen.getByText('sea').tagName).toBe('STRONG')
      expect(container.querySelector('script')).toBeNull()
      expect(container.querySelector('b')).toBeNull()
    })

    it('renders a (server-sanitized) HTML article as HTML', () => {
      renderArticle({ content_type: 'html', content_body: '<h2>Warming seas</h2><p>Hot.</p>' })
      expect(screen.getByRole('heading', { name: 'Warming seas' })).toBeInTheDocument()
      expect(screen.getByText('Hot.').tagName).toBe('P')
    })

    it('renders a brokered body as markdown, raw HTML dropped', () => {
      const { container } = renderArticle({
        content_type: 'brokered',
        content_body: '# Abstract\n\n<i>x</i>Plain.',
      })
      expect(screen.getByRole('heading', { name: 'Abstract' })).toBeInTheDocument()
      expect(container.querySelector('i')).toBeNull()
    })

    it('links Open to content_uri for a work hosted elsewhere', () => {
      renderArticle({ content_type: 'pdf', content_uri: 'https://cdn.example.com/ocean.pdf' })
      const open = screen.getByRole('link', { name: /Open/ })
      expect(open).toHaveAttribute('href', 'https://cdn.example.com/ocean.pdf')
      expect(open).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  it('guards a refresh or close while on screen, and drops the guard once gone', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderArticle({ content_type: 'markdown', content_body: 'Hot seas.' })

    const registered = add.mock.calls.filter(([type]) => type === 'beforeunload')
    expect(registered).toHaveLength(1)
    const handler = registered[0][1] as (e: BeforeUnloadEvent) => unknown
    const event = { preventDefault: vi.fn(), returnValue: '' } as unknown as BeforeUnloadEvent
    handler(event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.returnValue).toBe("You won't be able to view this again without buying it again.")

    unmount()
    expect(remove).toHaveBeenCalledWith('beforeunload', handler)
  })

  describe('sampling a work for a bulk licence', () => {
    const URL = 'https://inc.com/ocean-heat'
    const PUBLICATION = { id: 'pub-1', name: 'Inc.', bulk_licensable: true, topics: [] }
    const DELIVERY = { content_type: 'brokered', content_body: 'Hot seas.' }

    /** Renders the article with the page's Selection banner, as the search page does. */
    function renderWithSummary(result: ContentSearchResultWithPublication) {
      return render(
        <>
          <ExportSelectionSummary />
          <ArticleView work={{ result, delivery: DELIVERY }} onBack={vi.fn()} />
        </>,
      )
    }

    const brokered = (publication = PUBLICATION) =>
      makeResult({ content_type: 'brokered', url: URL, publication })

    it('Add to selection puts the bought work in the Selection, which the banner counts', async () => {
      const user = userEvent.setup()
      renderWithSummary(brokered())
      expect(screen.queryByText(/selected from/)).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Add to selection' }))

      expect(JSON.parse(sessionStorage.getItem('lw_export_selection') ?? '[]')).toEqual([
        { url: URL, publicationId: 'pub-1', publicationName: 'Inc.' },
      ])
      expect(screen.getByText('1 article selected from 1 publication')).toBeInTheDocument()
    })

    it('shows the work as added once it is in the Selection', async () => {
      const user = userEvent.setup()
      renderWithSummary(brokered())
      await user.click(screen.getByRole('button', { name: 'Add to selection' }))
      expect(screen.getByRole('button', { name: 'Added to selection' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Add to selection' })).not.toBeInTheDocument()
    })

    it('shows a work already in the Selection as added before any click', async () => {
      sessionStorage.setItem(
        'lw_export_selection',
        JSON.stringify([{ url: URL, publicationId: 'pub-1', publicationName: 'Inc.' }]),
      )
      renderWithSummary(brokered())
      expect(await screen.findByRole('button', { name: 'Added to selection' })).toBeDisabled()
    })

    it('a result from a Publication that isn’t bulk-licensable links to it but can’t be added', () => {
      renderWithSummary(brokered({ ...PUBLICATION, bulk_licensable: false }))
      expect(screen.getByRole('link', { name: 'Browse all from Inc.' })).toHaveAttribute(
        'href',
        '/catalog/pub-1',
      )
      expect(screen.queryByRole('button', { name: /to selection/ })).not.toBeInTheDocument()
    })

    it('a bulk-licensable result links to its Publication and says a bulk licence is charged again', () => {
      renderWithSummary(brokered())
      expect(
        screen.getByText(
          'Licensing this work in bulk is a second delivery, charged separately from this purchase.',
        ),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Browse all from Inc.' })).toHaveAttribute(
        'href',
        '/catalog/pub-1',
      )
    })

    it('a LedeWire-native result offers neither Add to selection nor a Publication to browse', () => {
      renderWithSummary(makeResult({ url: 'https://dailyplanet.example/ocean', publication: null }))
      expect(screen.queryByRole('button', { name: /to selection/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Browse all/ })).not.toBeInTheDocument()
      expect(screen.queryByText(/second delivery/)).not.toBeInTheDocument()
    })
  })
})
