import { NextResponse } from 'next/server'
import { contactDb } from '@/lib/supabase-db'
import {
  CreateContactSchema,
  DeleteContactsSchema,
  validateBody,
  formatZodErrors
} from '@/lib/api-validation'
import { getRequestOrgId } from '@/lib/org-context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/contacts
 * List contacts scoped to the current user's organization
 */
export async function GET() {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const contacts = await contactDb.getAll(orgId)
    return NextResponse.json(contacts, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
    })
  } catch (error) {
    console.error('Failed to fetch contacts:', error)
    return NextResponse.json({ error: 'Falha ao buscar contatos' }, { status: 500 })
  }
}

/**
 * POST /api/contacts
 * Add a contact to the current user's organization
 */
export async function POST(request: Request) {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const validation = validateBody(CreateContactSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: formatZodErrors(validation.error) },
        { status: 400 }
      )
    }

    const contact = await contactDb.add({
      ...validation.data,
      organizationId: orgId === '*' ? undefined : orgId,
    } as any)
    return NextResponse.json(contact, { status: 201 })
  } catch (error: any) {
    console.error('Failed to add contact:', error)
    return NextResponse.json({ error: 'Falha ao adicionar contato', details: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/contacts
 * Delete multiple contacts
 */
export async function DELETE(request: Request) {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const validation = validateBody(DeleteContactsSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: formatZodErrors(validation.error) },
        { status: 400 }
      )
    }

    const deleted = await contactDb.deleteMany(validation.data.ids, orgId)
    return NextResponse.json({ deleted })
  } catch (error) {
    console.error('Failed to delete contacts:', error)
    return NextResponse.json({ error: 'Falha ao deletar contatos' }, { status: 500 })
  }
}
