import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getRequestOrgId, applyOrgFilter } from '@/lib/org-context'

export async function GET() {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Fetch stats from Supabase scoped to the current organization
    const query = supabase
      .from('campaigns')
      .select('sent, delivered, read, failed, status')

    const { data, error } = await applyOrgFilter(query, orgId)

    if (error) throw error

    // Calculate aggregates
    let totalSent = 0
    let totalDelivered = 0
    let totalRead = 0
    let totalFailed = 0
    let activeCampaigns = 0

      ; (data || []).forEach(row => {
        totalSent += row.sent || 0
        totalDelivered += row.delivered || 0
        totalRead += row.read || 0
        totalFailed += row.failed || 0
        if (row.status === 'Enviando' || row.status === 'Agendado') {
          activeCampaigns++
        }
      })

    // Calculate delivery rate
    const deliveryRate = totalSent > 0
      ? Math.round((totalDelivered / totalSent) * 100)
      : 0

    return NextResponse.json(
      {
        totalSent,
        totalDelivered,
        totalRead,
        totalFailed,
        activeCampaigns,
        deliveryRate,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
