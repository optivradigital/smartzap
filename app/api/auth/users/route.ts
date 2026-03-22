/**
 * User Management API (Admin only)
 * GET: list users
 * POST: create user
 * DELETE: delete user (?id=xxx)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getAllUsers, createUser, deleteUser, updateUserPassword } from '@/lib/multi-user-auth'

async function requireAdmin(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Acesso negado — admin required' }, { status: 403 })
  return null
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const users = await getAllUsers()
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const body = await request.json()
  const { email, password, name, role } = body

  const result = await createUser(email, password, name || '', role || 'user')
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result.user, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  // Don't allow deleting yourself
  const currentUser = await getCurrentUser()
  if (currentUser?.id === id) return NextResponse.json({ error: 'Não é possível remover seu próprio usuário' }, { status: 400 })

  const ok = await deleteUser(id)
  if (!ok) return NextResponse.json({ error: 'Erro ao remover usuário' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const body = await request.json()
  const { id, password } = body
  if (!id || !password) return NextResponse.json({ error: 'id e password são obrigatórios' }, { status: 400 })

  const ok = await updateUserPassword(id, password)
  if (!ok) return NextResponse.json({ error: 'Erro ao atualizar senha' }, { status: 500 })
  return NextResponse.json({ success: true })
}
