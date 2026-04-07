/**
 * Campaign Worker — Self-Hosted (sem QStash/Upstash)
 * Processa campanhas localmente com suporte a:
 *  - Meta Cloud API (templates)
 *  - Evolution API (texto livre, anti-ban)
 *  - Delay aleatório entre mensagens
 *  - Spinning de mensagens (variações automáticas)
 *  - Simulação de digitação
 *  - Warm-up automático (limite diário crescente)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { campaignDb } from '@/lib/supabase-db'
import { createWhatsAppProvider } from '@/lib/whatsapp-provider/factory'
import { CampaignStatus } from '@/types'

interface Contact {
  phone: string
  name: string
}

interface WorkerPayload {
  campaignId: string
  contacts: Contact[]
  // Meta Cloud API
  templateName?: string
  templateVariables?: string[]
  phoneNumberId?: string
  accessToken?: string
  // Anti-ban settings
  delayMinMs?: number        // delay mínimo entre msgs (ms), default 3000
  delayMaxMs?: number        // delay máximo entre msgs (ms), default 10000
  messageVariants?: string[] // variações do texto (spinning). Ex: ["Oi {name}!", "Olá {name}!"]
  simulateTyping?: boolean   // enviar "digitando..." antes (Evolution apenas)
  dailyLimit?: number        // máx de msgs por dia neste número
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Spinning: escolhe uma variação aleatória e substitui {name} pelo nome do contato */
function spinMessage(variants: string[], contactName: string): string {
  if (!variants || variants.length === 0) return ''
  const picked = variants[Math.floor(Math.random() * variants.length)]
  return picked
    .replace(/\{name\}/gi, contactName || 'Cliente')
    .replace(/\{nome\}/gi, contactName || 'Cliente')
}

async function updateContactStatus(
  campaignId: string,
  phone: string,
  status: 'sent' | 'failed',
  messageId?: string,
  error?: string,
) {
  await supabase
    .from('campaign_contacts')
    .update({
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      failed_at: status === 'failed' ? new Date().toISOString() : null,
      message_id: messageId || null,
      error: error || null,
    })
    .eq('campaign_id', campaignId)
    .eq('phone', phone)
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body: WorkerPayload = await request.json()

  const {
    campaignId,
    contacts,
    templateName,
    templateVariables,
    phoneNumberId,
    accessToken,
    delayMinMs = 3000,
    delayMaxMs = 10000,
    messageVariants = [],
    simulateTyping = false,
    dailyLimit,
  } = body

  if (!campaignId || !contacts?.length) {
    return NextResponse.json({ error: 'campaignId e contacts são obrigatórios' }, { status: 400 })
  }

  // Responde imediatamente — processamento acontece em background
  // (Funciona em servidores Node.js; não funciona em serverless)
  const responsePromise = NextResponse.json({
    status: 'processing',
    count: contacts.length,
    message: `${contacts.length} mensagens em processamento`,
  }, { status: 202 })

  // Processa em background (não bloqueia a resposta)
  setImmediate(async () => {
    let sentCount = 0
    let failedCount = 0

    try {
      // Instancia o provider configurado (Meta ou Evolution)
      const provider = await createWhatsAppProvider()

      await campaignDb.updateStatus(campaignId, {
        status: CampaignStatus.SENDING,
        startedAt: new Date().toISOString(),
      })

      console.log(`[Worker] Campanha ${campaignId} iniciada | provider: ${provider.type} | ${contacts.length} contatos`)
      console.log(`[Worker] Anti-ban: delay ${delayMinMs}-${delayMaxMs}ms | typing: ${simulateTyping} | variants: ${messageVariants.length}`)

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]

        try {
          // Verifica se campanha foi pausada/cancelada
          const { data: cam } = await supabase
            .from('campaigns')
            .select('status')
            .eq('id', campaignId)
            .single()

          if (cam?.status === CampaignStatus.PAUSED || cam?.status === 'Cancelada') {
            console.log(`[Worker] Campanha ${campaignId} pausada/cancelada em ${i}/${contacts.length}`)
            break
          }

          // Verifica limite diário
          if (dailyLimit && sentCount >= dailyLimit) {
            console.log(`[Worker] Limite diário atingido: ${dailyLimit} msgs`)
            await updateContactStatus(campaignId, contact.phone, 'failed', undefined, 'Limite diário atingido')
            failedCount++
            continue
          }

          let result

          if (provider.type === 'evolution' && messageVariants.length > 0) {
            // Evolution + Spinning: envia texto livre com variação aleatória
            const text = spinMessage(messageVariants, contact.name)
            result = await sendEvolutionBlocks(provider, contact.phone, text, simulateTyping, sleep, randomBetween)
          } else if (provider.type === 'meta' && templateName) {
            // Meta Cloud API: usa template aprovado pelo Meta
            result = await sendMetaTemplate({
              phone: contact.phone,
              contactName: contact.name,
              templateName,
              templateVariables: templateVariables || [],
              phoneNumberId: phoneNumberId || '',
              accessToken: accessToken || '',
            })
          } else if (provider.type === 'evolution') {
            // Evolution sem variantes: usa templateName como texto base
            const text = (templateName || '').replace(/\{name\}/gi, contact.name)
            result = await sendEvolutionBlocks(provider, contact.phone, text, simulateTyping, sleep, randomBetween)
          } else {
            result = { success: false, error: 'Configuração de provider inválida' }
          }

          if (result.success) {
            await updateContactStatus(campaignId, contact.phone, 'sent', result.messageId)
            sentCount++
            console.log(`[Worker] ✅ Enviado para ${contact.phone} (${i + 1}/${contacts.length})`)
          } else {
            await updateContactStatus(campaignId, contact.phone, 'failed', undefined, result.error)
            failedCount++
            console.log(`[Worker] ❌ Falha ${contact.phone}: ${result.error}`)
          }

        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Erro desconhecido'
          await updateContactStatus(campaignId, contact.phone, 'failed', undefined, errMsg)
          failedCount++
          console.error(`[Worker] Erro em ${contact.phone}:`, errMsg)
        }

        // Delay aleatório anti-ban entre mensagens (pula no último)
        if (i < contacts.length - 1) {
          const delay = randomBetween(delayMinMs, delayMaxMs)
          console.log(`[Worker] Aguardando ${delay}ms antes da próxima mensagem...`)
          await sleep(delay)
        }

        // Atualiza stats a cada 10 mensagens ou no final
        if ((i + 1) % 10 === 0 || i === contacts.length - 1) {
          const campaign = await campaignDb.getById(campaignId)
          if (campaign) {
            await campaignDb.updateStatus(campaignId, {
              sent: (campaign.sent || 0) + sentCount,
              failed: (campaign.failed || 0) + failedCount,
            })
            sentCount = 0
            failedCount = 0
          }
        }
      }

      // Marca campanha como concluída
      const finalCampaign = await campaignDb.getById(campaignId)
      const allFailed = finalCampaign && finalCampaign.failed === finalCampaign.recipients && finalCampaign.recipients > 0
      await campaignDb.updateStatus(campaignId, {
        status: allFailed ? CampaignStatus.FAILED : CampaignStatus.COMPLETED,
        completedAt: new Date().toISOString(),
      })

      console.log(`[Worker] 🎉 Campanha ${campaignId} concluída!`)

    } catch (err) {
      console.error(`[Worker] Erro fatal na campanha ${campaignId}:`, err)
      await campaignDb.updateStatus(campaignId, { status: CampaignStatus.FAILED })
    }
  })

  return responsePromise
}

// ── Evolution Block Sender ─────────────────────────────────────────────────────

/**
 * Divide a mensagem em blocos por parágrafo duplo (\n\n) e envia cada um
 * como uma bolha separada, simulando digitação em todas elas.
 * Se não houver \n\n, envia como mensagem única (retrocompatível).
 */
async function sendEvolutionBlocks(
  provider: { sendText: (opts: { phone: string; text: string; simulateTyping?: boolean; typingDurationMs?: number }) => Promise<{ success: boolean; messageId?: string; error?: string }> },
  phone: string,
  text: string,
  simulateTyping: boolean,
  sleepFn: (ms: number) => Promise<void>,
  randomBetweenFn: (min: number, max: number) => number,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const blocks = text.split('\n\n').map(b => b.trim()).filter(Boolean)
  if (blocks.length === 0) return { success: false, error: 'Mensagem vazia' }

  let lastResult: { success: boolean; messageId?: string; error?: string } = { success: false }

  for (let i = 0; i < blocks.length; i++) {
    lastResult = await provider.sendText({
      phone,
      text: blocks[i],
      simulateTyping,
      typingDurationMs: randomBetweenFn(800, 2500),
    })

    if (!lastResult.success) return lastResult

    // Pausa entre blocos (exceto após o último)
    if (i < blocks.length - 1) {
      await sleepFn(randomBetweenFn(500, 1500))
    }
  }

  return lastResult
}

// ── Meta Template Sender (mantém compatibilidade) ─────────────────────────────

async function sendMetaTemplate({
  phone, contactName, templateName, templateVariables, phoneNumberId, accessToken,
}: {
  phone: string
  contactName: string
  templateName: string
  templateVariables: string[]
  phoneNumberId: string
  accessToken: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const parameters = [
    { type: 'text', text: contactName || 'Cliente' },
    ...templateVariables.map(v => ({ type: 'text', text: v })),
  ]

  const res = await fetch(
    `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'pt_BR' },
          components: [{ type: 'body', parameters }],
        },
      }),
    }
  )

  const data = await res.json()

  if (res.ok && data.messages?.[0]?.id) {
    return { success: true, messageId: data.messages[0].id }
  }

  return { success: false, error: data.error?.message || `HTTP ${res.status}` }
}
