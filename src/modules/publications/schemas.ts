/**
 * Issue #124: Publications domain module — Zod schemas.
 *
 * Re-exports the publishSchema from validations.ts (single source of truth
 * for the Zod schema) so the service layer can validate without importing
 * from scattered locations.
 */

export { publishSchema } from '@/lib/validations'
