/**
 * Campaign Status API
 *
 * This endpoint is DEPRECATED - stats are now fetched directly from Supabase.
 * Kept for backwards compatibility but returns data from Supabase.
 *
 * GET /api/campaign/[id]/status
 */

import { NextRequest, NextResponse } from 'next/server'
import { campaignDb } from '@/lib/supabase-db'
import { getRequestOrgId, SUPER_ADMIN_ORG } from '@/lib/org-context'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const orgId = await getRequestOrgId()
  if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id: campaignId } = await params

  try {
    const campaign = await campaignDb.getById(campaignId)

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (orgId !== SUPER_ADMIN_ORG && campaign.organizationId && campaign.organizationId !== orgId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    return NextResponse.json({
      campaignId,
      stats: {
        sent: campaign.sent || 0,
        delivered: campaign.delivered || 0,
        read: campaign.read || 0,
        failed: campaign.failed || 0,
        total: campaign.recipients || 0
      }
    })
  } catch (error) {
    console.error('Error fetching campaign status:', error)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}
