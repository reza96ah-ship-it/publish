# Architecture Rules

## Module Boundaries

Nashrino follows a modular monolith architecture with explicit dependency directions:

```
Route Handlers → Application Services → Repositories → Prisma
     ↕                    ↕                 ↕
  Transport           Domain Logic       Data Access
```

## Allowed Dependencies
- Route handlers may import: services, validation schemas, auth utilities
- Services may import: repositories, domain types, other services
- Repositories may import: Prisma client, domain types only
- Domain types may import: nothing (pure types, no runtime deps)

## Forbidden Dependencies
- Domain modules MUST NOT import: next/server, next/navigation, UI components
- Repositories MUST NOT contain business logic
- Services MUST NOT import Prisma directly (use repository interface)
- UI components MUST NOT import Prisma or repositories

## Architecture Enforcement
CI runs boundary tests (`tests/unit/architecture/boundary-tests.test.ts`) that:
- Verify no Next.js imports in domain modules
- Verify no UI imports in services/repositories
- Verify route handlers are thin (<100 lines)
- Verify no circular dependencies

## Module Map
- `src/modules/publications/` — content, publications, scheduling, reconciliation
- `src/modules/media/` — media upload, validation, lifecycle (planned)
- `src/modules/membership/` — invitations, members, roles (planned)
- `src/modules/identity/` — auth, MFA, sessions (planned)
