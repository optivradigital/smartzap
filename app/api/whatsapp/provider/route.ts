/**
 * API: WhatsApp Provider Settings
 * GET  — retorna config atual (manager+)
 * POST — salva nova config (manager+)
 */

import { NextRequest, NextResponse } from 'next/server'
import { saveProviderConfig, loadProviderConfig } from '@/lib/whatsapp-provider/factory'
import { requireManager } from '@/lib/role-guard'
import { getCurrentUser } from '@/lib/multi-user-auth'
import type { ProviderConfig } from '@/lib/whatsapp-provider/types'

export async function GET() {
  const { error } = await requireManager()
  if (error) return error

  const user = await getCurrentUser()
  const orgId = user?.organizationId
  const config = await loadProviderConfig(orgId)

  if (!config) return NextResponse.json({ type: 'meta' })

  const hasToken = !!(config.accessToken)
  const hasEvolutionKey = !!(config.evolutionApiKey)

  const hasGptToken = !!(config.gptmakerJwtToken)

  return NextResponse.json({
    type: config.type || 'meta',
    phoneNumberId: config.phoneNumberId || '',
    businessAccountId: config.businessAccountId || '',
    accessToken: '',
    tokenSaved: hasToken,
    tokenPreview: hasToken ? config.accessToken!.slice(0, 8) + '••••••' : '',
    evolutionUrl: config.evolutionUrl || '',
    evolutionInstance: config.evolutionInstance || '',
    evolutionApiKey: '',
    evolutionKeySaved: hasEvolutionKey,
    gptmakerAgentId: config.gptmakerAgentId || '',
    gptmakerJwtToken: '',
    gptmakerJwtTokenSaved: hasGptToken,
    gptmakerJwtTokenPreview: hasGptToken ? config.gptmakerJwtToken!.slice(0, 8) + '••••••' : '',
  })
}

export async function POST(req: NextRequest) {
  const { error } = await requireManager()
  if (error) return error

  const user = await getCurrentUser()
  const orgId = user?.organizationId

  const body: ProviderConfig & { tokenSaved?: boolean; evolutionKeySaved?: boolean } = await req.json()

  if (!body.type || !['meta', 'evolution'].includes(body.type)) {
    return NextResponse.json({ error: 'type deve ser meta ou evolution' }, { status: 400 })
  }

  if (body.type === 'evolution') {
    if (!body.evolutionUrl) return NextResponse.json({ error: 'evolutionUrl é obrigatório' }, { status: 400 })
    if (!body.evolutionInstance) return NextResponse.json({ error: 'evolutionInstance é obrigatório' }, { status: 400 })
    if (!body.evolutionApiKey) {
      const existing = await loadProviderConfig(orgId)
      body.evolutionApiKey = existing?.evolutionApiKey || ''
      if (!body.evolutionApiKey) return NextResponse.json({ error: 'evolutionApiKey é obrigatório' }, { status: 400 })
    }
  }

  if (body.type === 'meta') {
    if (!body.phoneNumberId) return NextResponse.json({ error: 'phoneNumberId é obrigatório' }, { status: 400 })
    if (!body.accessToken) {
      const existing = await loadProviderConfig(orgId)
      body.accessToken = existing?.accessToken || ''
      if (!body.accessToken) return NextResponse.json({ error: 'accessToken é obrigatório' }, { status: 400 })
    }
  }

  // GPT Maker: keep existing token if not sent
  if (!body.gptmakerJwtToken) {
    const existing = await loadProviderConfig(orgId)
    body.gptmakerJwtToken = existing?.gptmakerJwtToken || ''
  }

  const configToSave: ProviderConfig = {
    type: body.type,
    phoneNumberId: body.phoneNumberId,
    businessAccountId: body.businessAccountId,
    accessToken: body.accessToken,
    evolutionUrl: body.evolutionUrl,
    evolutionApiKey: body.evolutionApiKey,
    evolutionInstance: body.evolutionInstance,
    gptmakerAgentId: body.gptmakerAgentId || '',
    gptmakerJwtToken: body.gptmakerJwtToken || '',
  }

  await saveProviderConfig(configToSave, orgId)
  return NextResponse.json({ success: true })
}
