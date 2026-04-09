import { NextResponse } from 'next/server'
import { campaignDb, campaignContactDb } from '@/lib/supabase-db'
import { CreateCampaignSchema, validateBody, formatZodErrors } from '@/lib/api-validation'
import { getRequestOrgId } from '@/lib/org-context'

// Force dynamic - NO caching at all
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/campaigns
 * List campaigns scoped to the current user's organization
 */
export async function GET() {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const campaigns = await campaignDb.getAll(orgId)
    return NextResponse.json(campaigns, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    })
  } catch (error) {
    console.error('Failed to fetch campaigns:', error)
    return NextResponse.json({ error: 'Falha ao buscar campanhas' }, { status: 500 })
  }
}

interface CreateCampaignBody {
  name: string
  templateName: string
  recipients: number
  scheduledAt?: string
  selectedContactIds?: string[]
  contacts?: { name: string; phone: string }[]
  templateVariables?: string[]
  providerType?: 'meta' | 'evolution'
  delayMinSec?: number
  delayMaxSec?: number
  simulateTyping?: boolean
  dailyLimit?: number | null
  messageVariants?: string[]
}

/**
 * POST /api/campaigns
 * Create a new campaign in the current user's organization
 */
export async function POST(request: Request) {
  try {
    const orgId = await getRequestOrgId()
    if (!orgId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = validateBody(CreateCampaignSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: formatZodErrors(validation.error) },
        { status: 400 }
      )
    }

    const data = validation.data
    const campaign = await campaignDb.create({
      name: data.name,
      templateName: data.templateName,
      recipients: data.recipients,
      scheduledAt: data.scheduledAt,
      templateVariables: data.templateVariables,
      organizationId: orgId === '*' ? undefined : orgId,
      providerType: (data as any).providerType,
      delayMinMs: (data as any).delayMinSec != null ? (data as any).delayMinSec * 1000 : undefined,
      delayMaxMs: (data as any).delayMaxSec != null ? (data as any).delayMaxSec * 1000 : undefined,
      simulateTyping: (data as any).simulateTyping,
      dailyLimit: (data as any).dailyLimit,
      messageVariants: (data as any).messageVariants,
    })

    if (data.contacts && data.contacts.length > 0) {
      // Deduplicate by phone to avoid UNIQUE(campaign_id, phone) constraint failure
      const seen = new Set<string>()
      const uniqueContacts = data.contacts.filter(c => {
        if (seen.has(c.phone)) return false
        seen.add(c.phone)
        return true
      })
      await campaignContactDb.addContacts(
        campaign.id,
        uniqueContacts.map((c, index) => ({
          contactId: `temp_${index}`,
          phone: c.phone,
          name: c.name || '',
        }))
      )
    }

    return NextResponse.json(campaign, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create campaign:', error)
    return NextResponse.json({ error: 'Falha ao criar campanha', details: error?.message }, { status: 500 })
  }
}
