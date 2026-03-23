/**
 * Role Guard — SmartZap RBAC
 *
 * Roles hierarchy (highest → lowest):
 *   super_admin > manager > user
 *
 * Usage:
 *   const check = await requireRole('manager')
 *   if (check.error) return check.error   // NextResponse 401/403
 *   const user = check.user               // SmartZapUser
 */

import { NextResponse } from 'next/server'
import { getCurrentUser, SmartZapUser } from './multi-user-auth'

export type AppRole = 'super_admin' | 'manager' | 'user'

const ROLE_RANK: Record<AppRole, number> = {
  super_admin: 3,
  manager: 2,
  user: 1,
}

export function roleRank(role: string): number {
  return ROLE_RANK[role as AppRole] ?? 0
}

export function hasRole(user: SmartZapUser, minRole: AppRole): boolean {
  // is_super_admin always passes
  if (user.isSuperAdmin) return true
  return roleRank(user.role as AppRole) >= roleRank(minRole)
}

type GuardOk = { user: SmartZapUser; error: null }
type GuardFail = { user: null; error: NextResponse }

export async function requireRole(minRole: AppRole): Promise<GuardOk | GuardFail> {
  const user = await getCurrentUser()

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Nao autenticado' }, { status: 401 }),
    }
  }

  if (!hasRole(user, minRole)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: `Permissao insuficiente. Requer: ${minRole}` },
        { status: 403 }
      ),
    }
  }

  return { user, error: null }
}

/** Shorthand helpers */
export const requireSuperAdmin = () => requireRole('super_admin')
export const requireManager = () => requireRole('manager')
export const requireAnyUser = () => requireRole('user')
