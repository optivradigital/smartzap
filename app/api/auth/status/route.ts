/**
 * Auth Status API — Multi-User
 * GET: Check if the session is valid (any authenticated user)
 *      For super_admin: also returns list of all orgs + activeOrgId
 */

import { NextResponse } from 'next/server'
import { validateMultiUserSession, getCurrentUser, getActiveOrgId } from '@/lib/multi-user-auth'
import { isSetupComplete } from '@/lib/user-auth'
import { supabase } from '@/lib/supabase'

// Node.js runtime (not edge) — required for crypto/pbkdf2
export const runtime = 'nodejs'

export async function GET() {
  try {
    const isConfigured = !!process.env.MASTER_PASSWORD
    const isSetup = await isSetupComplete()
    const isAuthenticated = await validateMultiUserSession()
    const user = isAuthenticated ? await getCurrentUser() : null

    let organizations: { id: string; name: string; slug: string }[] = []
    let activeOrgId: string | null = null

    if (user?.isSuperAdmin) {
      // Fetch all orgs for the org switcher dropdown
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .order('name', { ascending: true })
      organizations = orgs || []

      // Get the active org from cookie
      activeOrgId = await getActiveOrgId()
      // If no active org selected yet, default to first org or user's own org
      if (!activeOrgId && organizations.length > 0) {
        activeOrgId = user.organizationId || organizations[0].id
      }
    }

    return NextResponse.json({
      isConfigured,
      isSetup,
      isAuthenticated,
      user,
      organizations,
      activeOrgId,
      // legacy compat
      company: user ? { name: user.name || user.email, email: user.email } : null,
    })
  } catch (error) {
    console.error('Auth status error:', error)
    return NextResponse.json({ isConfigured: false, isSetup: false, isAuthenticated: false, company: null }, { status: 500 })
  }
}
