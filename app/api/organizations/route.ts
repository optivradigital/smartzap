import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/multi-user-auth'
import { hashPassword } from '@/lib/multi-user-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/organizations
 * Super admin: list all orgs. Regular admin: return own org.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (user.isSuperAdmin) {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, slug, plan, created_at, owner_id')
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: 'Erro ao buscar organizações' }, { status: 500 })
    return NextResponse.json(data || [])
  }

  // Regular user — return own org
  if (!user.organizationId) return NextResponse.json([])

  const { data } = await supabase
    .from('organizations')
    .select('id, name, slug, plan, created_at')
    .eq('id', user.organizationId)
    .single()

  return NextResponse.json(data ? [data] : [])
}

/**
 * POST /api/organizations
 * Super admin only: create a new organization + first admin user
 */
export async function POST(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser?.isSuperAdmin) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const body = await request.json()
  const { name, slug, adminEmail, adminPassword, adminName } = body

  if (!name || !slug || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'name, slug, adminEmail e adminPassword são obrigatórios' }, { status: 400 })
  }

  // Create org
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name,
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      owner_id: currentUser.id,
      plan: 'basic',
    })
    .select()
    .single()

  if (orgError) {
    if (orgError.code === '23505') {
      return NextResponse.json({ error: 'Slug já existe. Escolha outro.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao criar organização' }, { status: 500 })
  }

  // Create admin user for the org
  const passwordHash = hashPassword(adminPassword)
  const { data: newUser, error: userError } = await supabase
    .from('smartzap_users')
    .insert({
      email: adminEmail.toLowerCase(),
      name: adminName || 'Admin',
      password_hash: passwordHash,
      role: 'manager',
      organization_id: org.id,
      is_super_admin: false,
    })
    .select('id, email, name, role')
    .single()

  if (userError) {
    // Rollback org
    await supabase.from('organizations').delete().eq('id', org.id)
    if (userError.code === '23505') {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao criar manager da organização' }, { status: 500 })
  }

  // Update org owner to the new user
  await supabase.from('organizations').update({ owner_id: newUser.id }).eq('id', org.id)

  return NextResponse.json({ org, user: newUser }, { status: 201 })
}

/**
 * DELETE /api/organizations?id=xxx
 * Super admin only
 */
export async function DELETE(request: Request) {
  const currentUser = await getCurrentUser()
  if (!currentUser?.isSuperAdmin) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  // Don't allow deleting Optivra (super admin's own org)
  const { data: org } = await supabase.from('organizations').select('slug').eq('id', id).single()
  if (org?.slug === 'optivra') {
    return NextResponse.json({ error: 'Não é possível deletar a organização principal' }, { status: 403 })
  }

  await supabase.from('smartzap_users').delete().eq('organization_id', id)
  await supabase.from('organizations').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
