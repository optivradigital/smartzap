import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { MessageStatus } from '@/types'
import { campaignDb } from '@/lib/supabase-db'
import { getRequestOrgId, SUPER_ADMIN_ORG } from '@/lib/org-context'

// Force dynamic rendering (no caching)
export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/campaigns/[id]/messages
 * Get messages for a campaign with pagination and aggregated stats
 * 
 * Query params:
 * - limit: number of messages per page (default: 50, max: 100)
 * - offset: pagination offset (default: 0)
 * - status: filter by status (optional)
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { id } = await params

    // Verify campaign ownership
    const campaign = await campaignDb.getById(id)
    if (!campaign) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
    }
    if (orgId !== SUPER_ADMIN_ORG && campaign.organizationId && campaign.organizationId !== orgId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    // Pagination params
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const statusFilter = searchParams.get('status')

    // 1. Get aggregated stats (parallel queries)
    const [
      { count: total },
      { count: pending },
      { count: sent },
      { count: delivered },
      { count: read },
      { count: failed },
      { count: invalid }
    ] = await Promise.all([
      supabase.from('campaign_contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', id),
      supabase.from('campaign_contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'pending'),
      supabase.from('campaign_contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'sent'),
      supabase.from('campaign_contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'delivered'),
      supabase.from('campaign_contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'read'),
      supabase.from('campaign_contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'failed'),
      supabase.from('campaign_contacts').select('*', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'invalid'),
    ])

    const aggregatedStats = {
      total: total || 0,
      pending: pending || 0,
      sent: sent || 0,
      delivered: delivered || 0,
      read: read || 0,
      failed: failed || 0,
      invalid: invalid || 0,
    }

    // 2. Get paginated messages
    let query = supabase
      .from('campaign_contacts')
      .select('id, phone, name, status, message_id, sent_at, delivered_at, read_at, error, failure_reason')
      .eq('campaign_id', id)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data: rows, error } = await query
      .order('sent_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const messages = (rows || []).map((row, index) => {
      // Map database status to MessageStatus enum
      let status = MessageStatus.PENDING
      const dbStatus = row.status as string

      if (dbStatus === 'sent') status = MessageStatus.SENT
      else if (dbStatus === 'delivered') status = MessageStatus.DELIVERED
      else if (dbStatus === 'read') status = MessageStatus.READ
      else if (dbStatus === 'failed') status = MessageStatus.FAILED
      else if (dbStatus === 'invalid') status = MessageStatus.NOT_EXISTS

      return {
        id: row.id as string || `msg_${id}_${offset + index}`,
        campaignId: id,
        contactName: row.name as string || row.phone as string,
        contactPhone: row.phone as string,
        status,
        messageId: row.message_id as string | undefined,
        sentAt: row.sent_at ? new Date(row.sent_at as string).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-',
        deliveredAt: row.delivered_at ? new Date(row.delivered_at as string).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : undefined,
        readAt: row.read_at ? new Date(row.read_at as string).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : undefined,
        error: row.error as string | undefined,
        failureReason: row.failure_reason as string | undefined,
      }
    })

    // Return paginated response with stats (no cache for real-time data)
    return NextResponse.json({
      messages,
      stats: aggregatedStats,
      pagination: {
        limit,
        offset,
        total: aggregatedStats.total,
        hasMore: offset + messages.length < aggregatedStats.total,
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error('Failed to fetch campaign messages:', error)
    return NextResponse.json(
      { error: 'Falha ao buscar mensagens', details: (error as Error).message },
      { status: 500 }
    )
  }
}
