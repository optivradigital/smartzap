/**
 * Organization Context Helper
 * 
 * Gets the current user's organization_id from their session.
 * Used by API routes to scope all database queries to the correct org.
 */

import { getCurrentUser } from './clerk-auth'

export const SUPER_ADMIN_ORG = '*'  // Sentinel for super admin (sees all)

/**
 * Get organization ID for the current request.
 * Returns null if not authenticated.
 * Returns the selected org when a super admin has one active via cookie.
 * Returns SUPER_ADMIN_ORG ('*') only when super admin has no org selected (sees all).
 */
export async function getRequestOrgId(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return null
  if (user.isSuperAdmin) return user.organizationId || SUPER_ADMIN_ORG
  return user.organizationId || null
}

/**
 * Apply organization filter to a Supabase query builder.
 * Super admins bypass the filter (see all orgs).
 */
export function applyOrgFilter<T>(
  query: T & { eq: (col: string, val: string) => T },
  orgId: string
): T {
  if (orgId === SUPER_ADMIN_ORG) return query
  return query.eq('organization_id', orgId)
}
