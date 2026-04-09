/**
 * Pause Campaign API
 *
 * POST /api/campaign/[id]/pause
 *
 * Pauses a running campaign. State is stored in Supabase.
 */

import { NextRequest, NextResponse } from 'next/server'
import { campaignDb } from '@/lib/supabase-db'
import { CampaignStatus } from '@/types'
import { getRequestOrgId, SUPER_ADMIN_ORG } from '@/lib/org-context'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const orgId = await getRequestOrgId()
  if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id: campaignId } = await params

  try {
    const existing = await campaignDb.getById(campaignId)
    if (!existing) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    if (orgId !== SUPER_ADMIN_ORG && existing.organizationId && existing.organizationId !== orgId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const campaign = await campaignDb.updateStatus(campaignId, {
      status: CampaignStatus.PAUSED,
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    console.log(`⏸️ Campaign ${campaignId} paused.`)

    return NextResponse.json({
      status: 'paused',
      campaignId,
    })
  } catch (error) {
    console.error('Error pausing campaign:', error)
    return NextResponse.json({ error: 'Failed to pause campaign' }, { status: 500 })
  }
}
