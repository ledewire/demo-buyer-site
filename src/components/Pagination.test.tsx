import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { PaginationMeta } from '@ledewire/node'
import Pagination from './Pagination'

function meta(overrides: Partial<PaginationMeta> = {}): PaginationMeta {
  return {
    total: 120,
    per_page: 50,
    current_page: 2,
    total_pages: 3,
    prev_page: 1,
    next_page: 3,
    ...overrides,
  }
}

const hrefFor = (page: number) => `/list?page=${page}`

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(
      <Pagination
        pagination={meta({
          total: 3,
          total_pages: 1,
          current_page: 1,
          prev_page: null,
          next_page: null,
        })}
        hrefFor={hrefFor}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('links the previous and next pages and says where it is', () => {
    render(<Pagination pagination={meta()} hrefFor={hrefFor} />)

    expect(screen.getByText('Page 2 of 3 · 120 total')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Previous' })).toHaveAttribute('href', '/list?page=1')
    expect(screen.getByRole('link', { name: 'Next →' })).toHaveAttribute('href', '/list?page=3')
  })

  it('leaves out Previous on the first page and Next on the last', () => {
    const { rerender } = render(
      <Pagination
        pagination={meta({ current_page: 1, prev_page: null, next_page: 2 })}
        hrefFor={hrefFor}
      />,
    )
    expect(screen.queryByRole('link', { name: '← Previous' })).not.toBeInTheDocument()

    rerender(
      <Pagination
        pagination={meta({ current_page: 3, prev_page: 2, next_page: null })}
        hrefFor={hrefFor}
      />,
    )
    expect(screen.queryByRole('link', { name: 'Next →' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Previous' })).toBeInTheDocument()
  })
})
