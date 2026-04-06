/**
 * Chatwoot Agent Bot Webhook
 * POST /api/chatwoot-bot?orgId={orgId}
 *
 * Recebe eventos de mensagem do Chatwoot Agent Bot, chama o GPT Maker
 * e posta a resposta de volta via API do Chatwoot.
 *
 * Configurar no Chatwoot:
 *   Settings → Integrations → Agent Bots → Add new Agent Bot
 *   Bot URL: https://seudominio.com/api/chatwoot-bot?orgId={orgId}
 */

import { NextRequest, NextResponse } from 'next/server'
import { loadProviderConfig } from '@/lib/whatsapp-provider/factory'
import { redis } from '@/lib/redis'

const HANDOFF_TTL_SECONDS = 8 * 60 * 60 // 8 hours
const ACTIVE_AGENT_TTL_SECONDS = 24 * 60 * 60 // 24 hours

function handoffKey(conversationId: number) {
  return `chatwoot:handoff:${conversationId}`
}

function activeAgentKey(conversationId: number) {
  return `chatwoot:active_agent:${conversationId}`
}

async function getActiveAgentId(conversationId: number, defaultAgentId: string): Promise<string> {
  const stored = await redis.get<string>(activeAgentKey(conversationId))
  return stored || defaultAgentId
}

async function setActiveAgentId(conversationId: number, agentId: string): Promise<void> {
  await redis.set(activeAgentKey(conversationId), agentId, { ex: ACTIVE_AGENT_TTL_SECONDS })
}

/**
 * Detects if Rocky's response contains a transfer to another agent.
 * Returns the target agentId if found, null otherwise.
 */
function detectAgentTransfer(message: string, routing: Record<string, string>): string | null {
  const lower = message.toLowerCase()
  for (const [name, id] of Object.entries(routing)) {
    if (name === 'default') continue
    if (lower.includes(name.toLowerCase())) return id
  }
  return null
}

async function isHandedOff(conversationId: number): Promise<boolean> {
  const val = await redis.exists(handoffKey(conversationId))
  return val === 1
}

async function markHandedOff(conversationId: number): Promise<void> {
  await redis.set(handoffKey(conversationId), '1', { ex: HANDOFF_TTL_SECONDS })
}

/**
 * Assigns the conversation to a team (or unassigns if no teamId) so a human can take over.
 */
async function assignToHuman(
  chatwootUrl: string,
  accountId: string,
  conversationId: number,
  apiToken: string,
  teamId?: string
): Promise<void> {
  const url = `${chatwootUrl.replace(/\/$/, '')}/api/v1/accounts/${accountId}/conversations/${conversationId}/assignments`
  const body = teamId ? { team_id: Number(teamId) } : {}
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api_access_token': apiToken },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    console.error(`[ChatwootBot] Failed to assign conversation ${conversationId} to human:`, res.status, err.slice(0, 200))
  } else {
    console.log(`[ChatwootBot] Conversation ${conversationId} handed off to human${teamId ? ` (team ${teamId})` : ''}`)
  }
}

interface ChatwootSender {
  id?: number
  name?: string
  phone_number?: string
  type?: string
}

interface ChatwootConversation {
  id: number
  meta?: {
    sender?: ChatwootSender
  }
}

interface ChatwootWebhookPayload {
  event?: string
  message_type?: string  // "incoming" | "outgoing" | "activity" | "template"
  content?: string
  conversation?: ChatwootConversation
  sender?: ChatwootSender
  inbox?: { id: number }
  account?: { id: number }
}

/**
 * Posta uma mensagem de resposta na conversa do Chatwoot
 */
async function postToChatwoot(
  chatwootUrl: string,
  accountId: string,
  conversationId: number,
  apiToken: string,
  content: string
): Promise<void> {
  const url = `${chatwootUrl.replace(/\/$/, '')}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_access_token': apiToken,
    },
    body: JSON.stringify({
      content,
      message_type: 'outgoing',
      private: false,
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error(`[ChatwootBot] Failed to post message to conversation ${conversationId}:`, res.status, errText.slice(0, 200))
  } else {
    console.log(`[ChatwootBot] Replied to conversation ${conversationId}: "${content.slice(0, 80)}"`)
  }
}

export async function POST(request: NextRequest) {
  // Always return 200 immediately to prevent Chatwoot from retrying
  const orgId = request.nextUrl.searchParams.get('orgId') || null

  let payload: ChatwootWebhookPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle incoming messages (ignore outgoing, activity, system messages)
  if (payload.event !== 'message_created' || payload.message_type !== 'incoming') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const content = payload.content?.trim()
  if (!content) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const conversationId = payload.conversation?.id
  if (!conversationId) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  // If this conversation was already handed off to a human, skip the bot
  if (await isHandedOff(conversationId)) {
    console.log(`[ChatwootBot] Conversation ${conversationId} is handed off — skipping bot`)
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Extract phone from sender info
  const phone = payload.conversation?.meta?.sender?.phone_number
    || payload.sender?.phone_number
    || null

  // Load org config
  let agentId: string | undefined
  let gptToken: string | undefined
  let chatwootUrl: string | undefined
  let chatwootAccountId: string | undefined
  let chatwootApiToken: string | undefined
  let chatwootInboxId: string | undefined
  let chatwootTeamId: string | undefined
  let agentRouting: Record<string, string> | undefined

  if (orgId) {
    try {
      const orgConfig = await loadProviderConfig(orgId)
      if (orgConfig?.gptmakerAgentId) agentId = orgConfig.gptmakerAgentId
      if (orgConfig?.gptmakerJwtToken) gptToken = orgConfig.gptmakerJwtToken
      if (orgConfig?.chatwootUrl) chatwootUrl = orgConfig.chatwootUrl
      if (orgConfig?.chatwootAccountId) chatwootAccountId = orgConfig.chatwootAccountId
      if (orgConfig?.chatwootApiToken) chatwootApiToken = orgConfig.chatwootApiToken
      if (orgConfig?.chatwootInboxId) chatwootInboxId = orgConfig.chatwootInboxId
      if (orgConfig?.chatwootTeamId) chatwootTeamId = orgConfig.chatwootTeamId
      if (orgConfig?.agentRouting) agentRouting = orgConfig.agentRouting
    } catch {
      // fall through to env
    }
  }

  // Fall back to env vars
  if (!agentId) agentId = process.env.GPTMAKER_AGENT_ID
  if (!gptToken) gptToken = process.env.GPTMAKER_JWT_TOKEN

  if (!agentId || !gptToken) {
    console.error('[ChatwootBot] GPT Maker credentials not configured for org', orgId)
    return NextResponse.json({ ok: false, error: 'GPT Maker not configured' }, { status: 200 })
  }

  if (!chatwootUrl || !chatwootAccountId || !chatwootApiToken) {
    console.error('[ChatwootBot] Chatwoot credentials not configured for org', orgId)
    return NextResponse.json({ ok: false, error: 'Chatwoot not configured' }, { status: 200 })
  }

  // Optional: filter by inbox ID
  if (chatwootInboxId && payload.inbox?.id) {
    if (String(payload.inbox.id) !== String(chatwootInboxId)) {
      console.log(`[ChatwootBot] Ignoring inbox ${payload.inbox.id} (configured: ${chatwootInboxId})`)
      return NextResponse.json({ ok: true, skipped: true })
    }
  }

  // Normalize phone (remove leading + for GPT Maker contextId)
  const normalizedPhone = phone ? phone.replace(/^\+/, '') : `conv_${conversationId}`

  console.log(`[ChatwootBot] Incoming from ${normalizedPhone} (conv ${conversationId}): "${content.slice(0, 80)}"`)

  // Determine which agent to call (may differ from default if already transferred)
  const defaultAgentId = agentRouting?.default || agentId
  const resolvedAgentId = defaultAgentId
    ? await getActiveAgentId(conversationId, defaultAgentId)
    : (agentId || '')

  // Process async — don't block the response
  ;(async () => {
    try {
      // Call GPT Maker using the currently active agent for this conversation
      const gptRes = await fetch(
        `https://api.gptmaker.ai/v2/agent/${resolvedAgentId}/conversation`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${gptToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contextId: normalizedPhone,
            phone: normalizedPhone,
            prompt: content,
            role: 'user',
          }),
        }
      )

      let reply: string | null = null
      let isHumanTransfer = false

      if (gptRes.ok) {
        const gptData = await gptRes.json().catch(() => null)
        const proj = gptData?.data || gptData?.projetion || gptData
        isHumanTransfer = proj?.humanize === true
        reply = proj?.message || proj?.response || proj?.content || proj?.originalMessage || null
        if (gptData) console.log('[ChatwootBot] GPT Maker response:', JSON.stringify(gptData).slice(0, 300))
      } else {
        const errText = await gptRes.text()
        console.error('[ChatwootBot] GPT Maker error', gptRes.status, errText.slice(0, 200))
      }

      if (!reply) {
        console.log('[ChatwootBot] No reply from GPT Maker for conv', conversationId)
        return
      }

      // Detect agent-to-agent transfer before posting (e.g. Rocky → Constansa/Demi)
      if (agentRouting && !isHumanTransfer) {
        const targetAgentId = detectAgentTransfer(reply, agentRouting)
        if (targetAgentId && targetAgentId !== resolvedAgentId) {
          await setActiveAgentId(conversationId, targetAgentId)
          console.log(`[ChatwootBot] Agent transfer detected → switching conv ${conversationId} to agent ${targetAgentId}`)
        }
      }

      // Post reply back to Chatwoot
      await postToChatwoot(
        chatwootUrl!,
        chatwootAccountId!,
        conversationId,
        chatwootApiToken!,
        reply
      )

      // Hand off to human if GPT Maker requested it
      if (isHumanTransfer) {
        await markHandedOff(conversationId)
        await assignToHuman(chatwootUrl!, chatwootAccountId!, conversationId, chatwootApiToken!, chatwootTeamId)
      }
    } catch (e) {
      console.error('[ChatwootBot] Error processing message:', e)
    }
  })()

  return NextResponse.json({ ok: true })
}
