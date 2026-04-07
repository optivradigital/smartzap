/**
 * POST /api/gptmaker/simulate
 * Simula uma mensagem do cliente para o GPT Maker (role: "user").
 * Útil para testar o agente sem precisar de WhatsApp real.
 *
 * Body: { phone: string, message: string, orgId?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireManager } from '@/lib/role-guard'
import { getCurrentUser } from '@/lib/multi-user-auth'
import { loadProviderConfig } from '@/lib/whatsapp-provider/factory'

export async function POST(request: NextRequest) {
  const { error } = await requireManager()
  if (error) return error

  const user = await getCurrentUser()
  const orgId = user?.organizationId || null

  let body: { phone?: string; message?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const phone = body.phone?.trim()
  const message = body.message?.trim()

  if (!phone || !message) {
    return NextResponse.json({ error: 'phone e message são obrigatórios' }, { status: 400 })
  }

  let agentId = process.env.GPTMAKER_AGENT_ID
  let token = process.env.GPTMAKER_JWT_TOKEN

  if (orgId) {
    try {
      const orgConfig = await loadProviderConfig(orgId)
      if (orgConfig?.gptmakerAgentId) agentId = orgConfig.gptmakerAgentId
      if (orgConfig?.gptmakerJwtToken) token = orgConfig.gptmakerJwtToken
    } catch { /* fall through */ }
  }

  if (!agentId || !token) {
    return NextResponse.json({ error: 'GPT Maker não configurado' }, { status: 400 })
  }

  const normalizedPhone = phone.replace(/^\+/, '')

  const res = await fetch(
    `https://api.gptmaker.ai/v2/agent/${agentId}/conversation`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        contextId: normalizedPhone,
        phone: normalizedPhone,
        prompt: message,
        role: 'user',
        channel: 'whatsapp',
      }),
    }
  )

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    console.error('[Simulate] GPT Maker error', res.status, JSON.stringify(data))
    return NextResponse.json({ error: 'Erro do GPT Maker', details: data }, { status: res.status })
  }

  const proj = data?.data || data?.projetion || data
  return NextResponse.json({
    ok: true,
    reply: proj?.message || proj?.response || proj?.content || null,
    humanize: proj?.humanize ?? false,
    raw: data,
  })
}
