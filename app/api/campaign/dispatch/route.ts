import { NextRequest, NextResponse } from 'next/server'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { supabase } from '@/lib/supabase'

interface DispatchContact {
  phone: string
  name: string
}

// Generate simple ID
const generateId = () => Math.random().toString(36).substr(2, 9)

// Trigger campaign dispatch workflow
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { campaignId, templateName, whatsappCredentials, templateVariables, flowId } = body
  let { contacts } = body

  // Get template variables from campaign if not provided directly
  let resolvedTemplateVariables: string[] = templateVariables || []
  if (!resolvedTemplateVariables.length) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('template_variables')
      .eq('id', campaignId)
      .single()

    if (campaign && campaign.template_variables) {
      if (Array.isArray(campaign.template_variables)) {
        resolvedTemplateVariables = campaign.template_variables
      } else if (typeof campaign.template_variables === 'string') {
        try {
          resolvedTemplateVariables = JSON.parse(campaign.template_variables)
        } catch {
          console.error('[Dispatch] Failed to parse template_variables string:', campaign.template_variables)
          resolvedTemplateVariables = []
        }
      }
    }
    console.log(`[Dispatch] Loaded template_variables from database:`, resolvedTemplateVariables)
  }

  // If no contacts provided, fetch from campaign_contacts
  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    const { data: existingContacts, error } = await supabase
      .from('campaign_contacts')
      .select('phone, name')
      .eq('campaign_id', campaignId)

    if (error) {
      console.error('Failed to fetch existing contacts:', error)
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
    }

    if (!existingContacts || existingContacts.length === 0) {
      return NextResponse.json({ error: 'No contacts found for campaign' }, { status: 400 })
    }

    contacts = existingContacts.map(row => ({
      phone: row.phone as string,
      name: (row.name as string) || ''
    }))

    console.log(`[Dispatch] Loaded ${contacts.length} contacts from database for campaign ${campaignId}`)
  } else {
    // Save contacts to campaign_contacts table
    try {
      const dbContacts = (contacts as DispatchContact[]).map(c => ({
        id: generateId(),
        campaign_id: campaignId,
        phone: c.phone,
        name: c.name || '',
        status: 'pending'
      }))

      const { error } = await supabase
        .from('campaign_contacts')
        .upsert(dbContacts, { onConflict: 'campaign_id, phone' })

      if (error) throw error
      console.log(`[Dispatch] Saved ${contacts.length} contacts for campaign ${campaignId}`)
    } catch (error) {
      console.error('Failed to save campaign contacts:', error)
    }
  }

  // Get credentials: Body > Redis > Env
  let phoneNumberId: string | undefined
  let accessToken: string | undefined

  if (whatsappCredentials?.phoneNumberId &&
    whatsappCredentials?.accessToken &&
    !whatsappCredentials.accessToken.includes('***')) {
    phoneNumberId = whatsappCredentials.phoneNumberId
    accessToken = whatsappCredentials.accessToken
  }

  if (!phoneNumberId || !accessToken) {
    const redisCredentials = await getWhatsAppCredentials()
    if (redisCredentials) {
      phoneNumberId = redisCredentials.phoneNumberId
      accessToken = redisCredentials.accessToken
    }
  }

  if (!phoneNumberId) phoneNumberId = process.env.WHATSAPP_PHONE_ID
  if (!accessToken) accessToken = process.env.WHATSAPP_TOKEN

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json(
      { error: 'Credenciais WhatsApp não configuradas. Configure em Configurações.' },
      { status: 401 }
    )
  }

  // Build the base URL for the workflow endpoint
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim())
    || 'http://localhost:3000'

  const workflowPayload = {
    campaignId,
    templateName,
    contacts: contacts as DispatchContact[],
    templateVariables: resolvedTemplateVariables,
    phoneNumberId,
    accessToken,
  }

  console.log(`[Dispatch] Firing workflow in background: ${baseUrl}/api/campaign/process`)
  console.log(`[Dispatch] Contacts: ${(contacts as DispatchContact[]).length}, Template: ${templateName}`)

  // Fire-and-forget: call workflow endpoint directly in background.
  // On self-hosted EC2/Node.js there is no 10s request timeout (unlike Vercel),
  // so the workflow runs to completion without needing QStash.
  const workflowUrl = `${baseUrl}/api/campaign/process`
  fetch(workflowUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflowPayload),
  }).then(r => {
    if (!r.ok) r.text().then(t => console.error('[Dispatch] Workflow error response:', t))
    else console.log('[Dispatch] Workflow completed successfully')
  }).catch(err => console.error('[Dispatch] Workflow fetch error:', err))

  return NextResponse.json({
    status: 'queued',
    count: (contacts as DispatchContact[]).length,
    message: `${(contacts as DispatchContact[]).length} mensagens enfileiradas com sucesso`
  }, { status: 202 })
}
