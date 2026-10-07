import type { CompanyMachineUserMcpKey } from '@ledewire/node'

/** The API's limit on a Machine user's name. Shared by the route and the Add machine form. */
export const MAX_MACHINE_NAME_LENGTH = 100

export type McpKeyScope = CompanyMachineUserMcpKey['scopes'][number]

/** The Scopes a Machine user's MCP key may carry. Shared by the route and the Issue key form. */
export const MCP_KEY_SCOPES: readonly McpKeyScope[] = ['mcp:search', 'mcp:purchase']

export function isMcpKeyScope(value: unknown): value is McpKeyScope {
  return MCP_KEY_SCOPES.includes(value as McpKeyScope)
}
