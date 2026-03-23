import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getRequestOrgId } from '@/lib/org-context'

export const dynamic = 'force-dynamic'

const BRANDING_KEYS = ['brand_name', 'brand_logo_url', 'brand_primary_color']

export async function GET() {
  try {
    const orgId = await getRequestOrgId()
    const effectiveOrg = orgId && orgId !== '*' ? orgId : 'default'
    const prefixedKeys = BRANDING_KEYS.map(k => effectiveOrg + ':' + k)

    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', prefixedKeys)

    const branding: Record<string, string> = {
      brand_name: 'SmartZap',
      brand_logo_url: '',
      brand_primary_color: '#16a34a',
    }

    ;(data || []).forEach(row => {
      const key = row.key.split(':').pop()
      if (key && key in branding) branding[key] = row.value || ''
    })

    return NextResponse.json(branding)
  } catch {
    return NextResponse.json({ brand_name: 'SmartZap', brand_logo_url: '', brand_primary_color: '#16a34a' })
  }
}

export async function POST(request: Request) {
  const orgId = await getRequestOrgId()
  if (!orgId) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  const effectiveOrg = orgId !== '*' ? orgId : 'default'
  const body = await request.json()
  const now = new Date().toISOString()

  const upserts = BRANDING_KEYS
    .filter(k => body[k] !== undefined)
    .map(k => ({
      key: effectiveOrg + ':' + k,
      value: String(body[k] || ''),
      organization_id: effectiveOrg !== 'default' ? effectiveOrg : null,
      updated_at: now,
    }))

  if (upserts.length === 0) return NextResponse.json({ success: true })

  const { error } = await supabase.from('settings').upsert(upserts, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
