/**
 * User Management API
 * GET:    list users (super_admin: all; manager: own org only)
 * POST:   create user (manager: own org / user role only; super_admin: any org & role)
 * DELETE: delete user (manager: own org users only; super_admin: any)
 * PATCH:  update password (manager: own org; super_admin: any)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, deleteUser, updateUserPassword, hashPassword } from '@/lib/multi-user-auth'
import { requireManager } from '@/lib/role-guard'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { user, error } = await requireManager()
  if (error) return error

  if (user!.isSuperAdmin) {
    // super_admin: all users with org info
    const { data, error: dbError } = await supabase
      .from('smartzap_users')
      .select('id, email, name, role, organization_id, is_super_admin, created_at, last_login')
      .order('created_at', { ascending: true })
    if (dbError) return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
    return NextResponse.json(data || [])
  }

  // Manager: only users in own org
  const { data, error: dbError } = await supabase
    .from('smartzap_users')
    .select('id, email, name, role, organization_id, created_at, last_login')
    .eq('organization_id', user!.organizationId!)
    .order('created_at', { ascending: true })

  if (dbError) return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireManager()
  if (error) return error

  const body = await request.json()
  const { email, password, name, role, organizationId } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'email e password são obrigatórios' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  // Determine target org
  const targetOrgId: string = user!.isSuperAdmin
    ? (organizationId || user!.organizationId || 'default')
    : user!.organizationId!

  // Role restriction: manager can only create 'user' role; super_admin can create any
  const targetRole: string = role || 'user'
  const allowedRoles = user!.isSuperAdmin
    ? ['super_admin', 'manager', 'user']
    : ['manager', 'user']

  if (!allowedRoles.includes(targetRole)) {
    return NextResponse.json(
      { error: `Sem permissão para criar usuário com role '${targetRole}'` },
      { status: 403 }
    )
  }

  // Check email uniqueness
  const { data: existing } = await supabase
    .from('smartzap_users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single()

  if (existing) return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 400 })

  const passwordHash = hashPassword(password)
  const now = new Date().toISOString()

  const { data: newUser, error: insertError } = await supabase
    .from('smartzap_users')
    .insert({
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      name: (name || '').trim(),
      role: targetRole,
      organization_id: targetOrgId,
      is_super_admin: targetRole === 'super_admin',
      created_at: now,
    })
    .select('id, email, name, role, organization_id, created_at')
    .single()

  if (insertError || !newUser) {
    console.error('Create user error:', insertError)
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
  }

  return NextResponse.json(newUser, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireManager()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  if (user!.id === id) {
    return NextResponse.json({ error: 'Não é possível remover seu próprio usuário' }, { status: 400 })
  }

  // Manager: only can delete users in own org with role 'user'
  if (!user!.isSuperAdmin) {
    const { data: target } = await supabase
      .from('smartzap_users')
      .select('organization_id, role')
      .eq('id', id)
      .single()

    if (!target) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    if (target.organization_id !== user!.organizationId) {
      return NextResponse.json({ error: 'Sem permissão para remover este usuário' }, { status: 403 })
    }
    if (target.role === 'manager' || target.role === 'super_admin') {
      return NextResponse.json({ error: 'Apenas o super admin pode remover managers ou admins' }, { status: 403 })
    }
  }

  const ok = await deleteUser(id)
  if (!ok) return NextResponse.json({ error: 'Erro ao remover usuário' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireManager()
  if (error) return error

  const body = await request.json()
  const { id, password } = body
  if (!id || !password) return NextResponse.json({ error: 'id e password são obrigatórios' }, { status: 400 })

  if (!user!.isSuperAdmin) {
    const { data: target } = await supabase
      .from('smartzap_users')
      .select('organization_id')
      .eq('id', id)
      .single()

    if (!target || target.organization_id !== user!.organizationId) {
      return NextResponse.json({ error: 'Sem permissão para atualizar este usuário' }, { status: 403 })
    }
  }

  const ok = await updateUserPassword(id, password)
  if (!ok) return NextResponse.json({ error: 'Erro ao atualizar senha' }, { status: 500 })
  return NextResponse.json({ success: true })
}
