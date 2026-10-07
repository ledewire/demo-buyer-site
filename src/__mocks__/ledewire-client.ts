/**
 * Shared mock for createBuyerClient().
 *
 * Usage in test files:
 *   vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
 */
import { createMockClient } from '@ledewire/node/testing'
import { vi } from 'vitest'

const mockClient = vi.mocked(createMockClient(vi.fn), true)

export const mockAuth = mockClient.auth
export const mockWallet = mockClient.wallet
export const mockPurchases = mockClient.purchases
export const mockUserApiKeys = mockClient.user.apiKeys
export const mockUserSpendCap = mockClient.user.spendCap
export const mockCompany = mockClient.company
export const mockPublications = mockClient.publications
export const mockAcquisitions = mockClient.acquisitions

export const createBuyerClient = vi.fn().mockResolvedValue(mockClient)
