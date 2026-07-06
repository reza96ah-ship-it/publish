/**
 * NextAuth type augmentation — adds id, role, activeWorkspaceId to session.
 */

import type { DefaultSession, DefaultUser } from 'next-auth'
import type { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession['user']
    activeWorkspaceId: string | null
  }

  interface User extends DefaultUser {
    role?: string
    activeWorkspaceId?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id?: string
    role?: string
    activeWorkspaceId?: string | null
  }
}
