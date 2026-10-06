import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

import { NotFoundError, LedewireError } from '@ledewire/node'
import { mockCompany } from '@/__mocks__/ledewire-client'
import { getCompanyMembership } from './company'

describe('getCompanyMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the membership', async () => {
    const membership = {
      id: 'm1',
      company_id: 'c1',
      company_name: 'Acme',
      role: 'admin' as const,
      joined_at: '2026-01-01T00:00:00Z',
    }
    mockCompany.membership.get.mockResolvedValue(membership)
    expect(await getCompanyMembership()).toEqual(membership)
  })

  it('returns null when the buyer belongs to no Company', async () => {
    mockCompany.membership.get.mockRejectedValue(new NotFoundError('no company'))
    expect(await getCompanyMembership()).toBeNull()
  })

  it('rethrows other errors', async () => {
    mockCompany.membership.get.mockRejectedValue(new LedewireError('boom', 500))
    await expect(getCompanyMembership()).rejects.toThrow('boom')
  })
})
