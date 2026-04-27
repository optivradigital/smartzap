import { auth, currentUser } from '@clerk/nextjs/server'
import { supabase } from './supabase'
import type { SmartZapUser } from './multi-user-auth'
import { cookies } from 'next/headers'

const ACTIVE_ORG_COOKIE = 'smartzap_active_org'

export async function getCurrentUser(): Promise<SmartZapUser | null> {
  try {
    const { userId } = await auth()
    if (!userId) return null

    const clerkUser = await currentUser()
    if (!clerkUser) return null

    const email =
      clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      ''

    if (!email) return null

    const { data: user } = await supabase
      .from('smartzap_users')
      .select('id, email, name, role, organization_id, is_super_admin')
      .eq('email', email.toLowerCase())
      .single()

    if (!user) return null

    const isSuperAdmin = user.is_super_admin || false
    let effectiveOrgId: string | undefined = user.organization_id || undefined

    if (isSuperAdmin) {
      const cookieStore = await cookies()
      const activeOrg = cookieStore.get(ACTIVE_ORG_COOKIE)?.value
      if (activeOrg) effectiveOrgId = activeOrg
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name || '',
      role: user.role as 'admin' | 'user',
      createdAt: '',
      organizationId: effectiveOrgId,
      isSuperAdmin,
    }
  } catch {
    return null
  }
}

export async function getActiveOrgId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    return cookieStore.get(ACTIVE_ORG_COOKIE)?.value || null
  } catch {
    return null
  }
}
