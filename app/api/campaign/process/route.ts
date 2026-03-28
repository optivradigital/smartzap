/**
 * Campaign Processor — direct execution without QStash
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { campaignDb, botConversationDb, botMessageDb } from '@/lib/supabase-db'
import { CampaignStatus } from '@/types'
import { getUserFriendlyMessage } from '@/lib/whatsapp-errors'

// Fixed ID for Demi (GPT Maker) bot
const DEMI_BOT_ID = 'demi-gptmaker-v1'


interface Contact {
  phone: string
  name: string
}

interface ProcessPayload {
  campaignId: string
  templateName: string
  contacts: Contact[]
  templateVariables?: string[]
  phoneNumberId: string
  accessToken: string
}

function buildBodyParameters(contactName: string, templateVariables: string[] = []) {
  // Only return parameters if the template actually uses them.
  // If there are no templateVariables AND contactName will be {{1}}, we still
  // return the name as first param — but callers must check if the template
  // actually declares that variable before including components.
  const all = [contactName || 'Cliente', ...templateVariables]
  return all.map(v => ({ type: 'text', text: v }))
}

async function updateContactStatus(
  campaignId: string,
  phone: string,
  status: 'sent' | 'failed',
  messageId?: string,
  error?: string
) {
  try {
    await supabase
      .from('campaign_contacts')
      .update({
        status,
        sent_at: new Date().toISOString(),
        message_id: messageId || null,
        error: error || null,
      })
      .eq('campaign_id', campaignId)
      .eq('phone', phone)
  } catch (e) {
    console.error(`Failed to update contact status: ${phone}`, e)
  }
}

export async function POST(request: NextRequest) {
  let payload: ProcessPayload

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { campaignId, templateName, contacts, templateVariables = [], phoneNumberId, accessToken } = payload

  if (!campaignId || !templateName || !contacts?.length || !phoneNumberId || !accessToken) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  console.log(`🚀 [Process] Campaign ${campaignId} — ${contacts.length} contacts, template: ${templateName}`)

  // Mark as SENDING
  await campaignDb.updateStatus(campaignId, {
    status: CampaignStatus.SENDING,
    startedAt: new Date().toISOString(),
  })

  let sentCount = 0
  let failedCount = 0

  for (const contact of contacts) {
    try {
      // Check if paused
      const { data: camp } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', campaignId)
        .single()

      if (camp?.status === CampaignStatus.PAUSED) {
        console.log(`⏸️  Campaign ${campaignId} paused — stopping`)
        break
      }

      // Build the template object.
      // Only add components/parameters when the caller explicitly provides
      // templateVariables (indicating the template has body variables).
      // Never auto-inject the contact name unless templateVariables is non-empty
      // — some templates have no variables at all.
      const templateObj: Record<string, unknown> = {
        name: templateName,
        language: { code: 'pt_BR' },
      }

      if (templateVariables.length > 0) {
        const bodyParameters = buildBodyParameters(contact.name, templateVariables)
        templateObj.components = [{ type: 'body', parameters: bodyParameters }]
      }

      const apiUrl = `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: contact.phone,
          type: 'template',
          template: templateObj,
        }),
      })

      const data = await res.json()

      if (res.ok && data.messages?.[0]?.id) {
        const messageId = data.messages[0].id
        await updateContactStatus(campaignId, contact.phone, 'sent', messageId)
        sentCount++
        console.log(`✅ Sent to ${contact.phone} — msgId: ${messageId}`)
        // Store template dispatch in conversation history (visible in Conversas page)
        ;(async () => {
          try {
            let conv = await botConversationDb.getByContact(DEMI_BOT_ID, contact.phone)
            if (!conv) {
              conv = await botConversationDb.create({
                botId: DEMI_BOT_ID,
                contactPhone: contact.phone,
                contactName: contact.name || undefined,
              })
            }
            await botMessageDb.create({
              conversationId: conv.id,
              waMessageId: messageId,
              direction: 'outbound',
              origin: 'bot',
              type: 'template',
              content: {
                templateName,
                text: 'Template "' + templateName + '" enviado para ' + (contact.name || contact.phone),
              },
              status: 'sent',
            })
          } catch (e) {
            console.error('[Campaign] Failed to log template dispatch:', e)
          }
        })()
      } else {
        const errorCode = data.error?.code || 0
        const translated = getUserFriendlyMessage(errorCode) || data.error?.message || 'Unknown error'
        const errMsg = `(#${errorCode}) ${translated}`
        await updateContactStatus(campaignId, contact.phone, 'failed', undefined, errMsg)
        failedCount++
        console.log(`❌ Failed ${contact.phone}: ${errMsg}`)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Erro desconhecido'
      await updateContactStatus(campaignId, contact.phone, 'failed', undefined, errMsg)
      failedCount++
      console.error(`❌ Exception ${contact.phone}:`, err)
    }

    // 15ms delay between messages
    await new Promise(resolve => setTimeout(resolve, 15))
  }

  // Update campaign stats + mark complete
  const campaign = await campaignDb.getById(campaignId)
  if (campaign) {
    const finalSent = (campaign.sent || 0) + sentCount
    const finalFailed = (campaign.failed || 0) + failedCount
    const finalStatus =
      finalFailed === contacts.length && contacts.length > 0
        ? CampaignStatus.FAILED
        : CampaignStatus.COMPLETED

    await campaignDb.updateStatus(campaignId, {
      sent: finalSent,
      failed: finalFailed,
      status: finalStatus,
      completedAt: new Date().toISOString(),
    })
  }

  console.log(`🎉 [Process] Campaign ${campaignId} done — sent: ${sentCount}, failed: ${failedCount}`)

  return NextResponse.json({ sent: sentCount, failed: failedCount })
}
