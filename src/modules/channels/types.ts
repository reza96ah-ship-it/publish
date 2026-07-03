export interface AuthContext {
  workspaceId: string
  userId: string
  role?: string
}

export interface PlatformRow {
  id: string
  workspaceId: string
  name: string
  type: string
  status: string
  circuitState: string
  accountKind: string
  username: string | null
  primaryIssue: string | null
  lastSuccessAt: Date | null
  tokenSecret: string | null
  targetId: string | null
  tokenExpiresAt: Date | null
  lastError: string | null
  lastValidatedAt: Date | null
  createdAt: Date
}

export interface PlatformListItem {
  id: string
  name: string
  type: string
  state: string
  stateColor: string
  accounts: number
  primaryIssue: string | null
  lastSuccess: Date | null
  accountKind: string
  circuitState: string
  username: string | null
}

export interface PlatformListResult {
  data: PlatformListItem[]
  nextCursor: string | null
}

export interface ConnectInput {
  token: string
  targetId?: string
  name?: string
}

export interface ConnectResult {
  ok: boolean
  botInfo: { username?: string; firstName?: string } | null
  credentialStatus: string
  expiresAt: string | null
  scopes: string[]
}

export interface ValidateResult {
  valid: boolean
  botInfo: { username?: string; firstName?: string } | null
}
