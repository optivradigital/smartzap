import { NextResponse } from 'next/server'
import { campaignDb } from '@/lib/supabase-db'
import { getRequestOrgId, SUPER_ADMIN_ORG } from '@/lib/org-context'

// Force dynamic - no caching
export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * POST /api/campaigns/[id]/duplicate
 * Duplicate a campaign
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params

    // Verify ownership before duplicating
    const existing = await campaignDb.getById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Campanha original não encontrada' }, { status: 404 })
    }
    if (orgId !== SUPER_ADMIN_ORG && existing.organizationId && existing.organizationId !== orgId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const campaign = await campaignDb.duplicate(id)

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campanha original não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(campaign, { status: 201 })
  } catch (error) {
    console.error('Failed to duplicate campaign:', error)
    return NextResponse.json(
      { error: 'Falha ao duplicar campanha', details: (error as Error).message },
      { status: 500 }
    )
  }
}
