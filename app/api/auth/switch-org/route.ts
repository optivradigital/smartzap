/**
 * POST /api/auth/switch-org
 * Super admin only: set the active organization context.
 * Stores orgId in a cookie so all subsequent API calls use that org.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/clerk-auth'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'

const ACTIVE_ORG_COOKIE = 'smartzap_active_org'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!user.isSuperAdmin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { orgId } = await req.json()
  if (!orgId) return NextResponse.json({ error: 'orgId é obrigatório' }, { status: 400 })

  // Verify the org exists
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .single()

  if (error || !org) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })

  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  return NextResponse.json({ success: true, org })
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user?.isSuperAdmin) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_ORG_COOKIE)

  return NextResponse.json({ success: true })
}
