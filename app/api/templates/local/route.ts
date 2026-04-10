/**
 * POST /api/templates/local
 * Creates a template directly in Supabase (no Meta approval needed).
 * Used for Evolution (QR code) orgs — templates are free-form text.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireManager } from '@/lib/role-guard'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireManager()
  if (authError) return authError
  const orgId = user?.organizationId || null

  let body: { name?: string; content?: string; category?: string; language?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { name, content, category = 'UTILITY', language = 'pt_BR' } = body

  if (!name || !content) {
    return NextResponse.json({ error: 'name e content são obrigatórios' }, { status: 400 })
  }

  // Normalize name: lowercase, underscores, no spaces
  const normalizedName = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  if (!normalizedName) {
    return NextResponse.json({ error: 'Nome inválido. Use letras, números e underscores.' }, { status: 400 })
  }

  const components = [{ type: 'BODY', text: content.trim() }]

  const { data, error } = await supabase
    .from('templates')
    .upsert(
      {
        name: normalizedName,
        category,
        language,
        status: 'APPROVED',
        components,
        organization_id: orgId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'name,organization_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('[Templates/Local] Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const bodyComp = components.find(c => c.type === 'BODY')
  return NextResponse.json({
    id: normalizedName,
    name: normalizedName,
    category,
    language,
    status: 'APPROVED',
    content: bodyComp?.text || '',
    preview: bodyComp?.text || '',
    source: 'local',
  }, { status: 200 })
}

export async function DELETE(request: NextRequest) {
  const { error: authError, user } = await requireManager()
  if (authError) return authError
  const orgId = user?.organizationId || null

  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 })

  let query = supabase.from('templates').delete().eq('name', name)
  if (orgId) query = query.eq('organization_id', orgId)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
