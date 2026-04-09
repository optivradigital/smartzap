import { Campaign } from '@/types'
import { getRequestOrgId } from '@/lib/org-context'
import { campaignDb } from '@/lib/supabase-db'

export async function getCampaignsServer(): Promise<Campaign[]> {
    const orgId = await getRequestOrgId()
    if (!orgId) return []
    return campaignDb.getAll(orgId)
}
