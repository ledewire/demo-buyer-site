import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExportSelectionSummary from './ExportSelectionSummary'

describe('ExportSelectionSummary', () => {
  beforeEach(() => sessionStorage.clear())

  it('renders nothing when the selection is empty', () => {
    const { container } = render(<ExportSelectionSummary />)
    expect(container).toBeEmptyDOMElement()
  })

  it('summarises the selection and links to review', () => {
    sessionStorage.setItem(
      'lw_export_selection',
      JSON.stringify([
        { url: 'https://a.example/1', publicationId: 'p1', publicationName: 'A' },
        { url: 'https://a.example/2', publicationId: 'p1', publicationName: 'A' },
        { url: 'https://b.example/1', publicationId: 'p2', publicationName: 'B' },
      ]),
    )
    render(<ExportSelectionSummary />)
    expect(screen.getByText(/3 articles selected from 2 publications/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review export' })).toHaveAttribute(
      'href',
      '/exports/new',
    )
  })
})
