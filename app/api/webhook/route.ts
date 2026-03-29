import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { redis } from '@/lib/redis'
import {
  mapWhatsAppError,
  isCriticalError,
  isOptOutError,
  getUserFriendlyMessage,
  getErrorCategory
} from '@/lib/whatsapp-errors'
import { botDb, botConversationDb, botMessageDb, settingsDb } from '@/lib/supabase-db'
import { loadProviderConfig } from '@/lib/whatsapp-provider/factory'

// Fixed ID for Demi (GPT Maker) bot — created in Supabase bots table
const DEMI_BOT_ID = 'demi-gptmaker-v1'

// Default human transfer message (used when GPT Maker returns humanize:true with no content)
const DEFAULT_TRANSFER_MSG =
  'Sua solicitação foi registrada! Nossa equipe não estará disponível hoje (sexta-feira, 27/03), mas retornará seu contato na segunda-feira (30/03). Obrigado pela compreensão! 😊'

// Get WhatsApp Access Token — tries per-org config, falls back to global env
async function getWhatsAppAccessToken(orgId?: string | null): Promise<string | null> {
  // 1. Try per-org config from Redis
  if (orgId) {
    try {
      const cfg = await loadProviderConfig(orgId)
      if (cfg?.accessToken) return cfg.accessToken
    } catch { /* fall through */ }
  }
  // 2. Global settings (legacy)
  try {
    const token = await settingsDb.get('whatsapp_access_token')
    if (token) return token
  } catch { /* fall through */ }
  // 3. Env var fallback
  return process.env.WHATSAPP_TOKEN || null
}

// Get phone number ID per-org from Redis config
async function getPhoneNumberId(orgId?: string | null): Promise<string | null> {
  if (orgId) {
    try {
      const cfg = await loadProviderConfig(orgId)
      if (cfg?.phoneNumberId) return cfg.phoneNumberId
    } catch { /* fall through */ }
  }
  return process.env.WHATSAPP_PHONE_NUMBER_ID || null
}

// Get or generate webhook verify token
async function getVerifyToken(): Promise<string> {
  try {
    const storedToken = await settingsDb.get('webhook_verify_token')
    if (storedToken) return storedToken
    const newToken = crypto.randomUUID()
    await settingsDb.set('webhook_verify_token', newToken)
    console.log('🔑 Generated new webhook verify token:', newToken)
    return newToken
  } catch {
    if (process.env.WEBHOOK_VERIFY_TOKEN) return process.env.WEBHOOK_VERIFY_TOKEN.trim()
    return 'not-configured'
  }
}

// Meta Webhook Verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const MY_VERIFY_TOKEN = await getVerifyToken()

  if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully')
    return new Response(challenge || '', { status: 200 })
  }

  console.log('❌ Webhook verification failed')
  return new Response('Forbidden', { status: 403 })
}

// ── Demi (GPT Maker) conversation handler ────────────────────────────────────
async function handleDemiConversation(
  phone: string,
  message: string,
  waMessageId: string | undefined,
  phoneNumberId: string,
  accessToken: string
): Promise<void> {
  const gptToken = process.env.GPTMAKER_JWT_TOKEN
  const agentId  = process.env.GPTMAKER_AGENT_ID
  if (!gptToken || !agentId) {
    console.error('[Demi] Missing GPTMAKER_JWT_TOKEN or GPTMAKER_AGENT_ID')
    return
  }

  // ── 0. Deduplication: skip if this wamid was already processed ────────────
  if (waMessageId) {
    try {
      const dupKey = 'demi:processed:' + waMessageId
      const already = await redis.get(dupKey)
      if (already) {
        console.log('[Demi] Duplicate wamid', waMessageId, '— skipping')
        return
      }
      // Mark as processed for 10 minutes
      await redis.set(dupKey, '1', { ex: 600 })
    } catch {
      // Redis failure — proceed anyway (better to risk a dup than to drop messages)
    }
  }

  try {
    // 1. Get or create bot_conversation for this phone number
    let conversation = await botConversationDb.getByContact(DEMI_BOT_ID, phone)
    if (!conversation) {
      conversation = await botConversationDb.create({
        botId: DEMI_BOT_ID,
        contactPhone: phone,
        contactName: undefined,
      })
      console.log('[Demi] Created new conversation:', conversation.id, 'for', phone)
    }
    const conversationId = conversation.id

    // 2. Store the incoming message
    await botMessageDb.create({
      conversationId,
      waMessageId,
      direction: 'inbound',
      origin: 'client',
      type: 'text',
      content: { text: message },
      status: 'delivered',
    })
    console.log('[Demi] Stored inbound message from', phone)

    // 3. Build context array from recent history
    //    → clean 'message' field so limitSubjects classifier works correctly
    //    → history goes in 'context' array (OpenAI-compatible format)
    const history = await botMessageDb.getByConversation(conversationId, 10)
    const recentHistory = history
      .filter(m => m.type === 'text' || m.type === 'template')
      .slice(0, -1)   // exclude the message just stored (current)
      .slice(-6)      // last 6 turns for context

    const contextMessages = recentHistory.map(m => {
      if (m.type === 'template') {
        const name = (m.content as Record<string, unknown>).templateName as string || ''
        return { role: 'assistant' as const, content: `[Template "${name}" enviado ao cliente]` }
      }
      const text = (m.content as Record<string, unknown>).text as string || ''
      return {
        role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
        content: text,
      }
    })

    // 4. Call GPT Maker
    //    - 'message'  = clean customer message (limitSubjects classifier sees this)
    //    - 'context'  = conversation history (AI uses for continuity)
    //    - unique conversationId per call to avoid GPT Maker session NPE
    const gptConvId = phone + '-' + Date.now()
    const gptRes = await fetch(
      'https://api.gptmaker.ai/assistants/' + agentId + '/conversation-test',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + gptToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          conversationId: gptConvId,
          context: contextMessages,
        }),
      }
    )

    let reply: string | null = null
    let isHumanTransfer = false

    if (gptRes.ok) {
      const gptData = await gptRes.json().catch(() => null)
      isHumanTransfer = gptData?.projetion?.humanize === true
      reply =
        gptData?.projetion?.content ||
        gptData?.projetion?.originalMessage ||
        null

      // If GPT Maker triggered human transfer but returned no text,
      // use the configured transfer message (or default)
      if (isHumanTransfer && !reply) {
        reply = await settingsDb.get('demi_transfer_message') || DEFAULT_TRANSFER_MSG
        console.log('[Demi] Human transfer triggered for', phone)
      }
    } else {
      const errText = await gptRes.text()
      console.error('[Demi] API error', gptRes.status, errText.slice(0, 200))
    }

    if (!reply) {
      console.log('[Demi] No reply for', phone)
      return
    }

    // 5. Store Demi's response in bot_messages
    await botMessageDb.create({
      conversationId,
      direction: 'outbound',
      origin: 'ai',
      type: 'text',
      content: { text: reply },
      status: 'pending',
    })

    // 6. Send response via WhatsApp
    const sendRes = await fetch(
      'https://graph.facebook.com/v24.0/' + phoneNumberId + '/messages',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: reply },
        }),
      }
    )

    if (!sendRes.ok) {
      console.error('[Demi] Send error:', await sendRes.text())
    } else {
      const sendData = await sendRes.json()
      const sentMsgId = sendData.messages?.[0]?.id
      console.log('[Demi] Demi →', phone + ':', reply.substring(0, 80))
      if (sentMsgId) {
        await botMessageDb.updateStatus(sentMsgId, 'sent')
      }
    }
  } catch (e) {
    console.error('[Demi] Exception:', e instanceof Error ? e.message : String(e))
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ status: 'ignored' })
  }

  console.log('📨 Webhook received:', JSON.stringify(body))

  try {
    const entries = body.entry || []

    for (const entry of entries) {
      const changes = entry.changes || []

      for (const change of changes) {
        const statuses = change.value?.statuses || []

        for (const statusUpdate of statuses) {
          const {
            id: messageId,
            status: msgStatus,
            errors
          } = statusUpdate

          const { data: existingUpdate } = await supabase
            .from('campaign_contacts')
            .select('id, status')
            .eq('message_id', messageId)
            .single()

          if (!existingUpdate) continue

          const statusOrder = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 }
          const currentOrder = statusOrder[existingUpdate.status as keyof typeof statusOrder] ?? 0
          const newOrder = statusOrder[msgStatus as keyof typeof statusOrder] ?? 0

          if (newOrder <= currentOrder && msgStatus !== 'failed') {
            console.log(`⏭️ Skipping: ${messageId} already at ${existingUpdate.status}, ignoring ${msgStatus}`)
            continue
          }

          const { data: contactInfo } = await supabase
            .from('campaign_contacts')
            .select('campaign_id, phone')
            .eq('message_id', messageId)
            .single()

          if (!contactInfo) continue

          const campaignId = contactInfo.campaign_id
          const phone = contactInfo.phone

          switch (msgStatus) {
            case 'sent':
              console.log(`📤 Sent confirmed: ${phone} (campaign: ${campaignId})`)
              break

            case 'delivered':
              console.log(`📬 Delivered: ${phone} (campaign: ${campaignId})`)
              try {
                const now = new Date().toISOString()
                const { data: updatedRows, error: updateError } = await supabase
                  .from('campaign_contacts')
                  .update({ status: 'delivered', delivered_at: now })
                  .eq('campaign_id', campaignId)
                  .eq('phone', phone)
                  .neq('status', 'delivered')
                  .neq('status', 'read')
                  .select('id')

                if (updateError) throw updateError

                if (updatedRows && updatedRows.length > 0) {
                  const { data: campaign } = await supabase
                    .from('campaigns')
                    .select('delivered')
                    .eq('id', campaignId)
                    .single()

                  if (campaign) {
                    await supabase
                      .from('campaigns')
                      .update({ delivered: (campaign.delivered || 0) + 1 })
                      .eq('id', campaignId)
                  }

                  console.log(`✅ Delivered count incremented for campaign ${campaignId}`)

                  await supabase
                    .from('account_alerts')
                    .update({ dismissed: true })
                    .eq('type', 'payment')
                    .eq('dismissed', false)
                }
              } catch (e) {
                console.error('Update failed (delivered):', e)
              }
              break

            case 'read':
              console.log(`👁️ Read: ${phone} (campaign: ${campaignId})`)
              try {
                const nowRead = new Date().toISOString()
                const { data: updatedRowsRead, error: updateErrorRead } = await supabase
                  .from('campaign_contacts')
                  .update({ status: 'read', read_at: nowRead })
                  .eq('campaign_id', campaignId)
                  .eq('phone', phone)
                  .neq('status', 'read')
                  .select('id')

                if (updateErrorRead) throw updateErrorRead

                if (updatedRowsRead && updatedRowsRead.length > 0) {
                  const { data: campaign } = await supabase
                    .from('campaigns')
                    .select('read')
                    .eq('id', campaignId)
                    .single()

                  if (campaign) {
                    await supabase
                      .from('campaigns')
                      .update({ read: (campaign.read || 0) + 1 })
                      .eq('id', campaignId)
                  }

                  console.log(`✅ Read count incremented for campaign ${campaignId}`)
                }
              } catch (e) {
                console.error('Update failed (read):', e)
              }
              break

            case 'failed':
              const errorCode = errors?.[0]?.code || 0
              const errorTitle = errors?.[0]?.title || 'Unknown error'
              const errorDetails = errors?.[0]?.error_data?.details || errors?.[0]?.message || ''
              const mappedError = mapWhatsAppError(errorCode)
              const failureReason = mappedError.userMessage

              console.log(`❌ Failed: ${phone} - [${errorCode}] ${errorTitle} (campaign: ${campaignId})`)

              try {
                const nowFailed = new Date().toISOString()
                const { data: updatedRowsFailed, error: updateErrorFailed } = await supabase
                  .from('campaign_contacts')
                  .update({
                    status: 'failed',
                    failed_at: nowFailed,
                    failure_code: errorCode,
                    failure_reason: failureReason
                  })
                  .eq('campaign_id', campaignId)
                  .eq('phone', phone)
                  .neq('status', 'failed')
                  .select('id')

                if (updateErrorFailed) throw updateErrorFailed

                if (updatedRowsFailed && updatedRowsFailed.length > 0) {
                  const { data: campaign } = await supabase
                    .from('campaigns')
                    .select('failed')
                    .eq('id', campaignId)
                    .single()

                  if (campaign) {
                    await supabase
                      .from('campaigns')
                      .update({ failed: (campaign.failed || 0) + 1 })
                      .eq('id', campaignId)
                  }
                }

                if (isCriticalError(errorCode)) {
                  await supabase
                    .from('account_alerts')
                    .upsert({
                      id: `alert_${errorCode}_${Date.now()}`,
                      type: mappedError.category,
                      code: errorCode,
                      message: mappedError.userMessage,
                      details: JSON.stringify({ title: errorTitle, details: errorDetails, action: mappedError.action }),
                      created_at: nowFailed
                    })
                }

              } catch (e) {
                console.error('Update failed (failed):', e)
              }
              break
          }
        }

        // ── Incoming messages: GPT Maker handles AI responses ────────────────
        // SmartZap is Opção A: campaigns + status tracking only.
        // GPT Maker's native WhatsApp channel is the sole AI responder.
        const messages = change.value?.messages || []
        for (const message of messages) {
          console.log(`📩 Incoming from ${message.from}: ${message.type} (handled by GPT Maker)`)
        }
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error)
  }

  return NextResponse.json({ status: 'ok' })
}
