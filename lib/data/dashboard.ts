import { supabase } from '@/lib/supabase'
import { DashboardStats, ChartDataPoint } from '@/services/dashboardService'
import { getCampaignsServer } from './campaigns'
import { getRequestOrgId, SUPER_ADMIN_ORG } from '@/lib/org-context'

export async function getDashboardStatsServer(): Promise<{ stats: DashboardStats, recentCampaigns: any[] }> {
    const orgId = await getRequestOrgId()

    // Guard: if not authenticated, return empty stats instead of showing all orgs data
    if (!orgId) {
        return {
            stats: { sent24h: '0', deliveryRate: '0%', activeCampaigns: '0', failedMessages: '0', chartData: [] },
            recentCampaigns: []
        }
    }

    let statsQuery = supabase.from('campaigns').select('sent, delivered, read, failed, status')
    if (orgId !== SUPER_ADMIN_ORG) {
        statsQuery = statsQuery.eq('organization_id', orgId)
    }

    // Parallel fetch stats source data and campaigns
    const [statsData, campaigns] = await Promise.all([
        statsQuery,
        getCampaignsServer()
    ])

    // --- Aggregate Stats ---
    const { data, error } = statsData
    if (error) {
        console.error('Error fetching dashboard stats:', error)
        // Return empty/safe defaults
        return {
            stats: {
                sent24h: '0',
                deliveryRate: '0%',
                activeCampaigns: '0',
                failedMessages: '0',
                chartData: []
            },
            recentCampaigns: []
        }
    }

    let totalSent = 0
    let totalDelivered = 0
    // let totalRead = 0 // Unused in summary but used in chart
    let totalFailed = 0
    let activeCampaignsCount = 0

        ; (data || []).forEach(row => {
            totalSent += row.sent || 0
            totalDelivered += row.delivered || 0
            // totalRead += row.read || 0
            totalFailed += row.failed || 0
            if (row.status === 'Enviando' || row.status === 'Agendado') {
                activeCampaignsCount++
            }
        })

    const deliveryRate = totalSent > 0
        ? Math.round((totalDelivered / totalSent) * 100)
        : 0

    // --- Chart Data ---
    // Based on recent campaigns
    const recentCampaigns = campaigns.slice(0, 5)

    const chartData: ChartDataPoint[] = campaigns.slice(0, 7).map(c => ({
        name: c.name?.substring(0, 3) || '?',
        sent: c.recipients || 0,
        read: c.read || 0
    })).reverse()

    return {
        stats: {
            sent24h: totalSent.toLocaleString(),
            deliveryRate: `${deliveryRate}%`,
            activeCampaigns: activeCampaignsCount.toString(),
            failedMessages: totalFailed.toString(),
            chartData
        },
        recentCampaigns
    }
}
