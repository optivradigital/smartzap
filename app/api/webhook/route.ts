import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { redis } from '@/lib/redis'
import {
  mapWhatsAppError,
  isCriticalError,
  getUserFriendlyMessage,
} from '@/lib/whatsapp-errors'
import { botDb, botConversationDb, botMessageDb, settingsDb } from '@/lib/supabase-db'
import { loadProviderConfig } from '@/lib/whatsapp-provider/factory'

// Fixed ID for the AI bot — created in Supabase bots table
const AI_BOT_ID = 'demi-gptmaker-v1'

// Default human transfer message
const DEFAULT_TRANSFER_MSG =
  'Sua solicitação foi registrada! Nossa equipe entrará em contato em breve. Obrigado!'

// ── Provider type for reply routing ──────────────────────────────────────────
type ReplyProvider =
  | { type: 'meta'; phoneNumberId: string; accessToken: string }
  | { type: 'evolution'; evolutionUrl: string; evolutionApiKey: string; instanceName: string }

// ── Find orgId by Evolution instance name (scan Redis) ───────────────────────
async function findOrgByEvolutionInstance(instanceName: string): Promise<string | null> {
  try {
    const keys = await redis.keys('whatsapp:provider:config:*')
    for (const key of keys) {
      const raw = await redis.get(key)
      if (!raw) continue
      const config = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw))
      if (config.evolutionInstance === instanceName) {
        return key.replace('whatsapp:provider:config:', '')
      }
    }
  } catch { /* non-fatal */ }
  return null
}

// ── Find orgId by Meta phoneNumberId (scan Redis) ────────────────────────────
async function findOrgByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  try {
    const keys = await redis.keys('settings:whatsapp:credentials:*')
    for (const key of keys) {
      const raw = await redis.get(key)
      if (!raw) continue
      const config = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw))
      if (config.phoneNumberId === phoneNumberId) {
        return key.replace('settings:whatsapp:credentials:', '')
      }
    }
  } catch { /* non-fatal */ }
  return null
}

// ── Helper: get WhatsApp access token (Meta) ──────────────────────────────────
async function getWhatsAppAccessToken(orgId?: string | null): Promise<string | null> {
  if (orgId) {
    try {
      const cfg = await loadProviderConfig(orgId)
      if (cfg?.accessToken) return cfg.accessToken
    } catch { /* fall through */ }
  }
  try {
    const token = await settingsDb.get('whatsapp_access_token')
    if (token) return token
  } catch { /* fall through */ }
  return process.env.WHATSAPP_TOKEN || null
}

// ── Webhook verify token ──────────────────────────────────────────────────────
async function getVerifyToken(): Promise<string> {
  try {
    const storedToken = await settingsDb.get('webhook_verify_token')
    if (storedToken) return storedToken
    const newToken = crypto.randomUUID()
    await settingsDb.set('webhook_verify_token', newToken)
    return newToken
  } catch {
    if (process.env.WEBHOOK_VERIFY_TOKEN) return process.env.WEBHOOK_VERIFY_TOKEN.trim()
    return 'not-configured'
  }
}

// ── Meta Webhook Verification (GET) ──────────────────────────────────────────
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

// ── AI Agent conversation handler ─────────────────────────────────────────────
async function handleIncomingMessage(
  phone: string,
  message: string,
  waMessageId: string | undefined,
  provider: ReplyProvider,
  orgId?: string | null
): Promise<void> {
  // Load per-org GPT Maker credentials from Redis, fall back to global env
  let agentId = process.env.GPTMAKER_AGENT_ID
  let gptToken = process.env.GPTMAKER_JWT_TOKEN

  if (orgId) {
    try {
      const orgConfig = await loadProviderConfig(orgId)
      if (orgConfig?.gptmakerAgentId) agentId = orgConfig.gptmakerAgentId
      if (orgConfig?.gptmakerJwtToken) gptToken = orgConfig.gptmakerJwtToken
    } catch { /* fall through to env */ }
  }

  if (!gptToken || !agentId) {
    console.error('[Agent] Missing GPT Maker credentials for org', orgId)
    return
  }

  // ── Deduplication (atomic SET NX to avoid race conditions) ───────────────
  if (waMessageId) {
    try {
      const dupKey = 'agent:processed:' + waMessageId
      const isNew = await redis.set(dupKey, '1', { ex: 600, nx: true })
      if (!isNew) {
        console.log('[Agent] Duplicate message', waMessageId, '— skipping')
        return
      }
    } catch { /* proceed anyway */ }
  }

  try {
    // 1. Get or create conversation
    let conversation = await botConversationDb.getByContact(AI_BOT_ID, phone, orgId || undefined)
    if (!conversation) {
      conversation = await botConversationDb.create({
        botId: AI_BOT_ID,
        contactPhone: phone,
        contactName: undefined,
        organizationId: orgId || undefined,
      })
      console.log('[Agent] New conversation:', conversation.id, 'for', phone)
    }
    const conversationId = conversation.id

    // Se conversa está pausada (atendimento humano), não responder
    if (conversation.status === 'paused') {
      console.log('[Agent] Conversation paused (human operator) — skipping:', phone)
      return
    }

    // 2. Store incoming message
    await botMessageDb.create({
      conversationId,
      waMessageId,
      direction: 'inbound',
      origin: 'client',
      type: 'text',
      content: { text: message },
      status: 'delivered',
    })

    // 3. Build conversation context (last 6 turns)
    const history = await botMessageDb.getByConversation(conversationId, 10)
    const contextMessages = history
      .filter(m => m.type === 'text' || m.type === 'template')
      .slice(0, -1)
      .slice(-6)
      .map(m => {
        if (m.type === 'template') {
          const tplText = (m.content as Record<string, unknown>).text as string || ''
          const name = (m.content as Record<string, unknown>).templateName as string || ''
          return { role: 'assistant' as const, content: tplText || `[Template "${name}" enviado ao cliente]` }
        }
        const text = (m.content as Record<string, unknown>).text as string || ''
        return {
          role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
          content: text,
        }
      })

    // 4. Call GPT Maker — include campaign template as context if available
    const lastTemplate = history
      .filter(m => m.type === 'template' && m.direction === 'outbound')
      .at(-1)
    const templateText = lastTemplate
      ? ((lastTemplate.content as Record<string, unknown>).text as string) || null
      : null
    const promptWithContext = templateText
      ? `[Contexto da campanha: "${templateText}"]\nMensagem do cliente: ${message}`
      : message

    const gptRes = await fetch(
      `https://api.gptmaker.ai/v2/agent/${agentId}/conversation`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + gptToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextId: phone,
          phone: phone,
          prompt: promptWithContext,
          role: 'user',
          channel: 'whatsapp',
        }),
      }
    )

    let reply: string | null = null
    let isHumanTransfer = false

    if (gptRes.ok) {
      const gptData = await gptRes.json().catch(() => null)
      // v2 response: {success, data: {response, humanize}} or legacy {projetion: {content}}
      const proj = gptData?.data || gptData?.projetion || gptData
      isHumanTransfer = proj?.humanize === true
      reply = proj?.message || proj?.response || proj?.content || proj?.originalMessage || null
      if (gptData) console.log('[Agent] GPT Maker response:', JSON.stringify(gptData).slice(0, 300))
      if (isHumanTransfer && !reply) {
        reply = await settingsDb.get('demi_transfer_message') || DEFAULT_TRANSFER_MSG
        console.log('[Agent] Human transfer triggered for', phone)
      }
    } else {
      const errText = await gptRes.text()
      console.error('[Agent] GPT Maker error', gptRes.status, errText.slice(0, 200))
    }

    if (!reply) {
      console.log('[Agent] No reply for', phone)
      return
    }

    // 5. Send response and store with waMessageId
    if (provider.type === 'evolution') {
      const instanceEncoded = encodeURIComponent(provider.instanceName)
      const sendRes = await fetch(
        `${provider.evolutionUrl}/message/sendText/${instanceEncoded}`,
        {
          method: 'POST',
          headers: { apikey: provider.evolutionApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: phone, text: reply, delay: 0 }),
        }
      )
      if (!sendRes.ok) {
        console.error('[Agent] Evolution send error:', await sendRes.text())
        await botMessageDb.create({ conversationId, direction: 'outbound', origin: 'ai', type: 'text', content: { text: reply }, status: 'failed' })
      } else {
        const d = await sendRes.json().catch(() => null)
        const sentMsgId = d?.key?.id as string | undefined
        console.log('[Agent] →', phone + ':', reply.substring(0, 80))
        await botMessageDb.create({ conversationId, waMessageId: sentMsgId, direction: 'outbound', origin: 'ai', type: 'text', content: { text: reply }, status: sentMsgId ? 'sent' : 'pending' })
      }
    } else {
      // Meta Cloud API
      const sendRes = await fetch(
        `https://graph.facebook.com/v24.0/${provider.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + provider.accessToken,
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
        console.error('[Agent] Meta send error:', await sendRes.text())
        await botMessageDb.create({ conversationId, direction: 'outbound', origin: 'ai', type: 'text', content: { text: reply }, status: 'failed' })
      } else {
        const d = await sendRes.json()
        const sentMsgId = d.messages?.[0]?.id as string | undefined
        console.log('[Agent] →', phone + ':', reply.substring(0, 80))
        await botMessageDb.create({ conversationId, waMessageId: sentMsgId, direction: 'outbound', origin: 'ai', type: 'text', content: { text: reply }, status: sentMsgId ? 'sent' : 'pending' })
      }
    }
  } catch (e) {
    console.error('[Agent] Exception:', e instanceof Error ? e.message : String(e))
  }
}

// ── Main POST handler ─────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const body = await request.json()

  // ── Evolution: delivery/read status updates ──────────────────────────────
  if (body.event === 'messages.update') {
    const rawData = body.data
    const updates: Array<{ key: { id: string; fromMe: boolean }; update: { status: string } }> =
      Array.isArray(rawData) ? rawData : (rawData ? [rawData] : [])
    console.log(`[webhook/ack] messages.update: ${updates.length} update(s)`)
    for (const u of updates) {
      if (!u.key?.fromMe || !u.key?.id) continue
      const ack = u.update?.status
      // Evolution ACK: PENDING, SERVER_ACK, DELIVERY_ACK, READ
      let msgStatus: string | null = null
      if (ack === 'SERVER_ACK') msgStatus = 'sent'
      else if (ack === 'DELIVERY_ACK') msgStatus = 'delivered'
      else if (ack === 'READ') msgStatus = 'read'
      if (!msgStatus) continue

      console.log(`[webhook/ack] ${ack} → ${msgStatus} msgId=${u.key.id}`)

      // Update bot_messages (AI agent conversations)
      botMessageDb.updateStatus(u.key.id, msgStatus as 'sent' | 'delivered' | 'read')
        .catch(() => { /* non-fatal */ })

      // Update campaign_contacts for Evolution campaigns
      if (msgStatus === 'delivered' || msgStatus === 'read') {
        try {
          const { data: contact } = await supabase
            .from('campaign_contacts')
            .select('id, campaign_id, status')
            .eq('message_id', u.key.id)
            .single()

          console.log(`[webhook/ack] campaign_contacts lookup msgId=${u.key.id}: ${contact ? `found id=${contact.id} status=${contact.status}` : 'NOT FOUND'}`)

          if (contact) {
            const statusOrder: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 }
            const currentOrder = statusOrder[contact.status] ?? 0
            const newOrder = statusOrder[msgStatus] ?? 0

            if (newOrder > currentOrder) {
              const now = new Date().toISOString()
              const updateData = msgStatus === 'delivered'
                ? { status: 'delivered', delivered_at: now }
                : { status: 'read', read_at: now }

              const { data: updated } = await supabase
                .from('campaign_contacts')
                .update(updateData)
                .eq('id', contact.id)
                .select('id')

              if (updated?.length) {
                console.log(`[webhook/ack] updated campaign_contact ${contact.id} → ${msgStatus}`)
                const col = msgStatus === 'delivered' ? 'delivered' : 'read'
                const { data: campaign } = await supabase
                  .from('campaigns')
                  .select(col)
                  .eq('id', contact.campaign_id)
                  .single()
                if (campaign) {
                  await supabase.from('campaigns')
                    .update({ [col]: ((campaign as Record<string, number>)[col] || 0) + 1 })
                    .eq('id', contact.campaign_id)
                }
              }
            }
          }
        } catch (e) {
          console.error('[webhook/ack] error updating campaign_contacts:', e)
        }
      }
    }
    return NextResponse.json({ status: 'ok' })
  }

  // ── Evolution API webhook ─────────────────────────────────────────────────
  if (body.event === 'messages.upsert') {
    const msg = body.data
    if (!msg || msg.key?.fromMe) return NextResponse.json({ status: 'ok' })

    const remoteJid: string = msg.key?.remoteJid || ''
    if (remoteJid.endsWith('@g.us')) return NextResponse.json({ status: 'ok' }) // ignore groups

    const phone = remoteJid.replace('@s.whatsapp.net', '')
    const text: string =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption || ''

    if (!phone || !text) return NextResponse.json({ status: 'ok' })

    const instanceName: string = body.instance || ''
    console.log(`📩 [Evolution] Incoming from ${phone} (${instanceName}): "${text.substring(0, 60)}"`)

    const orgId = await findOrgByEvolutionInstance(instanceName)
    if (!orgId) {
      console.warn('[Agent] No org found for Evolution instance:', instanceName)
      return NextResponse.json({ status: 'ok' })
    }

    const orgConfig = await loadProviderConfig(orgId).catch(() => null)
    const evolutionUrl = orgConfig?.evolutionUrl || process.env.EVOLUTION_API_URL || ''
    const evolutionApiKey = orgConfig?.evolutionApiKey || process.env.EVOLUTION_API_KEY || ''

    // Mark message as read → sends blue ticks to sender
    if (evolutionUrl && evolutionApiKey && msg.key?.id && remoteJid) {
      fetch(`${evolutionUrl}/chat/markMessageAsRead/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        headers: { apikey: evolutionApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readMessages: [{ remoteJid, fromMe: false, id: msg.key.id }],
        }),
      }).catch(() => { /* non-fatal */ })
    }

    handleIncomingMessage(phone, text, msg.key?.id, {
      type: 'evolution', evolutionUrl, evolutionApiKey, instanceName,
    }, orgId).catch(e => console.error('[Agent/Evolution]', e))

    return NextResponse.json({ status: 'ok' })
  }

  // ── Meta Cloud API webhook ────────────────────────────────────────────────
  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ status: 'ignored' })
  }

  console.log('📨 Meta webhook received')

  try {
    const entries = Array.isArray(body.entry) ? body.entry : []

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : []

      for (const change of changes) {
        // ── Campaign status updates ─────────────────────────────────────────
        const statuses = Array.isArray(change.value?.statuses) ? change.value.statuses : []

        for (const statusUpdate of statuses) {
          const { id: messageId, status: msgStatus, errors } = statusUpdate

          // Update bot_messages delivery status (non-campaign AI replies)
          if (msgStatus === 'delivered' || msgStatus === 'read' || msgStatus === 'sent') {
            botMessageDb.updateStatus(messageId, msgStatus as 'sent' | 'delivered' | 'read')
              .catch(() => { /* non-fatal, message may not exist in bot_messages */ })
          }

          const { data: existingUpdate } = await supabase
            .from('campaign_contacts')
            .select('id, status')
            .eq('message_id', messageId)
            .single()

          if (!existingUpdate) continue

          const statusOrder = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 }
          const currentOrder = statusOrder[existingUpdate.status as keyof typeof statusOrder] ?? 0
          const newOrder = statusOrder[msgStatus as keyof typeof statusOrder] ?? 0

          if (newOrder <= currentOrder && msgStatus !== 'failed') continue

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
              console.log(`📤 Sent: ${phone} (campaign: ${campaignId})`)
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
                if (updatedRows?.length) {
                  const { data: campaign } = await supabase.from('campaigns').select('delivered').eq('id', campaignId).single()
                  if (campaign) await supabase.from('campaigns').update({ delivered: (campaign.delivered || 0) + 1 }).eq('id', campaignId)
                  await supabase.from('account_alerts').update({ dismissed: true }).eq('type', 'payment').eq('dismissed', false)
                }
              } catch (e) { console.error('Update failed (delivered):', e) }
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
                if (updatedRowsRead?.length) {
                  const { data: campaign } = await supabase.from('campaigns').select('read').eq('id', campaignId).single()
                  if (campaign) await supabase.from('campaigns').update({ read: (campaign.read || 0) + 1 }).eq('id', campaignId)
                }
              } catch (e) { console.error('Update failed (read):', e) }
              break

            case 'failed':
              const errorCode = errors?.[0]?.code || 0
              const errorTitle = errors?.[0]?.title || 'Unknown error'
              const errorDetails = errors?.[0]?.error_data?.details || errors?.[0]?.message || ''
              const mappedError = mapWhatsAppError(errorCode)
              console.log(`❌ Failed: ${phone} - [${errorCode}] ${errorTitle} (campaign: ${campaignId})`)
              try {
                const nowFailed = new Date().toISOString()
                const { data: updatedRowsFailed, error: updateErrorFailed } = await supabase
                  .from('campaign_contacts')
                  .update({ status: 'failed', failed_at: nowFailed, failure_code: errorCode, failure_reason: mappedError.userMessage })
                  .eq('campaign_id', campaignId)
                  .eq('phone', phone)
                  .neq('status', 'failed')
                  .select('id')
                if (updateErrorFailed) throw updateErrorFailed
                if (updatedRowsFailed?.length) {
                  const { data: campaign } = await supabase.from('campaigns').select('failed').eq('id', campaignId).single()
                  if (campaign) await supabase.from('campaigns').update({ failed: (campaign.failed || 0) + 1 }).eq('id', campaignId)
                }
                if (isCriticalError(errorCode)) {
                  await supabase.from('account_alerts').upsert({
                    id: `alert_${errorCode}_${Date.now()}`,
                    type: mappedError.category,
                    code: errorCode,
                    message: mappedError.userMessage,
                    details: JSON.stringify({ title: errorTitle, details: errorDetails, action: mappedError.action }),
                    created_at: nowFailed,
                  })
                }
              } catch (e) { console.error('Update failed (failed):', e) }
              break
          }
        }

        // ── Incoming messages → AI Agent (Meta Cloud API) ───────────────────
        const messages = Array.isArray(change.value?.messages) ? change.value.messages : []
        for (const message of messages) {
          if (message.type !== 'text' || !message.text?.body) continue

          const phoneNumberId: string = change.value?.metadata?.phone_number_id || ''
          const orgId = await findOrgByPhoneNumberId(phoneNumberId)
          if (!orgId) {
            console.warn('[Agent/Meta] No org found for phoneNumberId:', phoneNumberId)
            continue
          }
          const orgConfig = await loadProviderConfig(orgId).catch(() => null)

          // Se GPT Maker tem canal WhatsApp direto ativo, ele responde por conta própria.
          // SmartZap só rastreia status de entrega (tratado acima) — não processa respostas.
          if (orgConfig?.gptmakerDirectChannel) {
            console.log(`[Agent] gptmakerDirectChannel ativo — GPT Maker responde diretamente (${message.from})`)
            continue
          }

          const accessToken = await getWhatsAppAccessToken(orgId)
          if (!phoneNumberId || !accessToken) continue

          console.log(`📩 [Meta] Incoming from ${message.from}: "${message.text.body.substring(0, 60)}"`)

          handleIncomingMessage(
            message.from,
            message.text.body,
            message.id,
            { type: 'meta', phoneNumberId, accessToken },
            orgId
          ).catch(e => console.error('[Agent/Meta]', e))
        }
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error)
  }

  return NextResponse.json({ status: 'ok' })
}
