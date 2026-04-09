import { NextResponse } from 'next/server'
import { contactDb } from '@/lib/supabase-db'
import { getRequestOrgId, SUPER_ADMIN_ORG } from '@/lib/org-context'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/contacts/[id]
 * Get a single contact
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params
    const contact = await contactDb.getById(id)

    if (!contact) {
      return NextResponse.json(
        { error: 'Contato não encontrado' },
        { status: 404 }
      )
    }

    if (orgId !== SUPER_ADMIN_ORG && contact.organizationId && contact.organizationId !== orgId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    return NextResponse.json(contact)
  } catch (error) {
    console.error('Failed to fetch contact:', error)
    return NextResponse.json(
      { error: 'Falha ao buscar contato', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/contacts/[id]
 * Update a contact
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params

    // Verify ownership before updating
    const existing = await contactDb.getById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 })
    }
    if (orgId !== SUPER_ADMIN_ORG && existing.organizationId && existing.organizationId !== orgId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json()
    const contact = await contactDb.update(id, body)

    if (!contact) {
      return NextResponse.json(
        { error: 'Contato não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(contact)
  } catch (error) {
    console.error('Failed to update contact:', error)
    return NextResponse.json(
      { error: 'Falha ao atualizar contato', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/contacts/[id]
 * Delete a contact
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params

    // Verify ownership before deleting
    const existing = await contactDb.getById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 })
    }
    if (orgId !== SUPER_ADMIN_ORG && existing.organizationId && existing.organizationId !== orgId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    await contactDb.delete(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete contact:', error)
    return NextResponse.json(
      { error: 'Falha ao deletar contato', details: (error as Error).message },
      { status: 500 }
    )
  }
}
