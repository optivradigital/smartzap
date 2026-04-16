/**
 * Auth Status API
 * GET: Returns authenticated user info from session + org data from Supabase
 */

import { NextResponse } from 'next/server'
import { getCurrentUser, getActiveOrgId } from '@/lib/multi-user-auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({
        isAuthenticated: false,
        isConfigured: true,
        isSetup: true,
        user: null,
        organizations: [],
        activeOrgId: null,
        company: null,
      })
    }

    let organizations: { id: string; name: string; slug: string }[] = []
    let activeOrgId: string | null = null

    if (user.isSuperAdmin) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .order('name', { ascending: true })
      organizations = orgs || []

      activeOrgId = await getActiveOrgId()
      if (!activeOrgId && organizations.length > 0) {
        activeOrgId = user.organizationId || organizations[0].id
      }
    }

    return NextResponse.json({
      isConfigured: true,
      isSetup: true,
      isAuthenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin || false,
        organizationId: user.organizationId,
      },
      organizations,
      activeOrgId,
      company: { name: user.name, email: user.email },
    })
  } catch (error) {
    console.error('Auth status error:', error)
    return NextResponse.json(
      { isConfigured: false, isSetup: false, isAuthenticated: false, company: null },
      { status: 500 }
    )
  }
}
