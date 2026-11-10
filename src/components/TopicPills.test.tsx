import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import TopicPills from './TopicPills'

describe('TopicPills', () => {
  it('labels each topic in a list named Topics', () => {
    render(<TopicPills topics={['sports', 'books-and-literature']} />)

    const list = screen.getByRole('list', { name: 'Topics' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Sports', 'Books and literature'])
  })

  it('renders nothing when there are no topics', () => {
    const { container } = render(<TopicPills topics={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
