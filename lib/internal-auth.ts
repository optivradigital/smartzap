import { timingSafeEqual } from 'crypto'

// Chamadas servidor→servidor (dispatch/scheduler → /api/campaign/process). Rota é pública no
// Clerk, então exige este segredo. Mesmo container: qualquer env server-only serve de fallback.
export const INTERNAL_SECRET_HEADER = 'x-internal-secret'

export function internalSecret(): string {
  return process.env.INTERNAL_API_SECRET || process.env.CLERK_SECRET_KEY || ''
}

export function isInternalRequest(headers: Headers): boolean {
  const expected = internalSecret()
  const got = headers.get(INTERNAL_SECRET_HEADER) || ''
  if (!expected || got.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected))
}
