import { NextRequest, NextResponse } from 'next/server'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { getCurrentUser } from '@/lib/multi-user-auth'
import { requireAnyUser } from '@/lib/role-guard'
import { loadProviderConfig } from '@/lib/whatsapp-provider/factory'
import { supabase } from '@/lib/supabase'

interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  format?: string
  text?: string
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>
}

interface MetaTemplate {
  name: string
  status: string
  language: string
  category: string
  components: MetaTemplateComponent[]
  last_updated_time: string
}

async function fetchTemplatesFromMeta(businessAccountId: string, accessToken: string) {
  const allTemplates: MetaTemplate[] = []
  let nextUrl: string | null = `https://graph.facebook.com/v24.0/${businessAccountId}/message_templates?fields=name,status,language,category,components,last_updated_time&limit=100`

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error?.message || 'Failed to fetch templates')
    }
    const data = await res.json()
    allTemplates.push(...(data.data || []))
    nextUrl = data.paging?.next || null
  }

  return allTemplates.map((t: MetaTemplate) => {
    const bodyComponent = t.components.find((c: MetaTemplateComponent) => c.type === 'BODY')
    return {
      id: t.name,
      name: t.name,
      category: t.category,
      language: t.language,
      status: t.status,
      content: bodyComponent?.text || 'No content',
      preview: bodyComponent?.text || '',
      lastUpdated: t.last_updated_time,
      components: t.components,
      source: 'meta' as const,
    }
  })
}

// GET /api/templates
export async function GET() {
  try {
    const user = await getCurrentUser()
    const orgId = user?.organizationId || null
    const orgConfig = orgId ? await loadProviderConfig(orgId).catch(() => null) : null
    const isEvolution = orgConfig?.type === 'evolution'

    // Evolution orgs: return templates from Supabase (no Meta approval needed)
    if (isEvolution) {
      const query = supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (orgId) query.eq('organization_id', orgId)

      const { data: rows, error } = await query

      if (error) throw error

      return NextResponse.json(
        (rows || []).map(row => {
          const components = Array.isArray(row.components) ? row.components : []
          const bodyComp = components.find((c: MetaTemplateComponent) => c.type === 'BODY')
          const bodyText = bodyComp?.text || ''
          return {
            id: row.name,
            name: row.name,
            category: row.category || 'UTILITY',
            language: row.language || 'pt_BR',
            status: row.status || 'APPROVED',
            content: bodyText,
            preview: bodyText,
            lastUpdated: row.updated_at || row.created_at,
            components: row.components,
            source: 'local' as const,
          }
        })
      )
    }

    // Meta orgs: fetch from Meta API
    const credentials = await getWhatsAppCredentials(orgId)
    if (!credentials?.businessAccountId || !credentials?.accessToken) {
      return NextResponse.json(
        { error: 'Credenciais não configuradas. Configure em Configurações.' },
        { status: 401 }
      )
    }

    const templates = await fetchTemplatesFromMeta(credentials.businessAccountId, credentials.accessToken)
    return NextResponse.json(templates, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
    })
  } catch (error) {
    console.error('Templates API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// POST /api/templates — fetch with body credentials (Meta only, legacy)
export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireAnyUser()
  if (authError) return authError
  const orgId = user.organizationId || null

  let businessAccountId: string | undefined
  let accessToken: string | undefined

  try {
    const body = await request.json()
    if (body.businessAccountId && body.accessToken && !body.accessToken.includes('***')) {
      businessAccountId = body.businessAccountId
      accessToken = body.accessToken
    }
  } catch { /* empty body */ }

  if (!businessAccountId || !accessToken) {
    const credentials = await getWhatsAppCredentials(orgId)
    if (credentials) {
      businessAccountId = credentials.businessAccountId
      accessToken = credentials.accessToken
    }
  }

  if (!businessAccountId || !accessToken) {
    return NextResponse.json(
      { error: 'Credenciais não configuradas. Configure em Configurações.' },
      { status: 401 }
    )
  }

  try {
    const templates = await fetchTemplatesFromMeta(businessAccountId, accessToken)
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Meta API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
