/**
 * Auth Status API
 * GET: Returns authenticated user info via Clerk + org data from Supabase
 */

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getActiveOrgId } from '@/lib/clerk-auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
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

    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? ''

    // Look up user in smartzap_users by email
    const { data: dbUser } = await supabase
      .from('smartzap_users')
      .select('id, email, name, role, organization_id')
      .eq('email', email.toLowerCase())
      .single()

    const user = dbUser
      ? {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name || email,
          role: dbUser.role as 'super_admin' | 'manager' | 'user',
          isSuperAdmin: dbUser.role === 'super_admin',
          organizationId: dbUser.organization_id,
        }
      : {
          id: userId,
          email,
          name: clerkUser?.firstName
            ? `${clerkUser.firstName} ${clerkUser.lastName ?? ''}`.trim()
            : email,
          role: 'user' as const,
          isSuperAdmin: false,
          organizationId: null,
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
      user,
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
