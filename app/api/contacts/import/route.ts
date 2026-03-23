import { NextResponse } from 'next/server'
import { contactDb } from '@/lib/supabase-db'
import { ImportContactsSchema, validateBody, formatZodErrors } from '@/lib/api-validation'
import { ContactStatus } from '@/types'
import { getRequestOrgId } from '@/lib/org-context'

export const dynamic = 'force-dynamic'

/**
 * POST /api/contacts/import
 * Import multiple contacts from CSV/file — scoped to current org
 */
export async function POST(request: Request) {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()
    const validation = validateBody(ImportContactsSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: formatZodErrors(validation.error) },
        { status: 400 }
      )
    }

    const { contacts } = validation.data
    const contactsWithDefaults = contacts.map(c => ({
      name: c.name || '',
      phone: c.phone,
      status: ContactStatus.OPT_IN,
      tags: c.tags || [],
    }))

    const imported = await contactDb.import(
      contactsWithDefaults,
      orgId === '*' ? undefined : orgId
    )

    return NextResponse.json({
      imported,
      total: contacts.length,
      duplicates: contacts.length - imported
    })
  } catch (error) {
    console.error('Failed to import contacts:', error)
    return NextResponse.json({ error: 'Falha ao importar contatos' }, { status: 500 })
  }
}
