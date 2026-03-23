import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getRequestOrgId } from '@/lib/org-context'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const orgId = await getRequestOrgId()
  if (!orgId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ error: 'Supabase nao configurado' }, { status: 500 })

  const effectiveOrg = orgId !== '*' ? orgId : 'default'

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo nao permitido. Use PNG, JPG, SVG ou WebP.' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande. Maximo 2MB.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'png'
    const path = 'logos/' + effectiveOrg + '/logo.' + ext
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('[logo upload]', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)

    const now = new Date().toISOString()
    const { error: settingsError } = await supabase.from('settings').upsert({
      key: effectiveOrg + ':brand_logo_url',
      value: publicUrl,
      organization_id: effectiveOrg,
      updated_at: now,
    }, { onConflict: 'key' })

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 })
    }

    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
