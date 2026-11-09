/**
 * API: WhatsApp Provider Settings
 * GET  — retorna config atual (manager+)
 * POST — salva nova config (manager+)
 */

import { NextRequest, NextResponse } from 'next/server'
import { saveProviderConfig, loadProviderConfig, isOrgScoped, findOrgByEvolutionInstance } from '@/lib/whatsapp-provider/factory'
import { requireManager } from '@/lib/role-guard'
import { getCurrentUser } from '@/lib/clerk-auth'
import type { ProviderConfig } from '@/lib/whatsapp-provider/types'

export async function GET() {
  const { error } = await requireManager()
  if (error) return error

  const user = await getCurrentUser()
  const orgId = user?.organizationId
  const config = await loadProviderConfig(orgId)

  // If no Redis config, fall back to env vars for Evolution (server-configured deployments)
  const effectiveConfig: Partial<ProviderConfig> = config ?? {}
  const evolutionUrlFromEnv = process.env.EVOLUTION_API_URL || ''
  const evolutionKeyFromEnv = process.env.EVOLUTION_API_KEY || ''
  // Instância do .env pertence a uma org específica — org nova não herda
  const evolutionInstanceFromEnv = isOrgScoped(orgId) ? '' : process.env.EVOLUTION_INSTANCE || ''

  const hasEnvEvolution = !!(evolutionUrlFromEnv && evolutionKeyFromEnv)
  const resolvedType = effectiveConfig.type || (hasEnvEvolution ? 'evolution' : 'meta')
  const rawEvolutionUrl = effectiveConfig.evolutionUrl || evolutionUrlFromEnv
  // Form mostra a URL pública; a interna (Docker) só é usada no servidor (toInternalEvolutionUrl)
  const resolvedEvolutionUrl = process.env.EVOLUTION_PUBLIC_URL && rawEvolutionUrl === evolutionUrlFromEnv
    ? process.env.EVOLUTION_PUBLIC_URL
    : rawEvolutionUrl
  const resolvedEvolutionInstance = effectiveConfig.evolutionInstance || evolutionInstanceFromEnv
  const resolvedEvolutionKeyExists = !!(effectiveConfig.evolutionApiKey || evolutionKeyFromEnv)

  const hasToken = !!(effectiveConfig.accessToken)
  const hasGptToken = !!(effectiveConfig.gptmakerJwtToken)
  const hasChatwootToken = !!(effectiveConfig.chatwootApiToken)

  return NextResponse.json({
    type: resolvedType,
    phoneNumberId: effectiveConfig.phoneNumberId || '',
    businessAccountId: effectiveConfig.businessAccountId || '',
    accessToken: '',
    tokenSaved: hasToken,
    tokenPreview: hasToken ? effectiveConfig.accessToken!.slice(0, 8) + '••••••' : '',
    evolutionUrl: resolvedEvolutionUrl,
    evolutionInstance: resolvedEvolutionInstance,
    evolutionApiKey: '',
    evolutionKeySaved: resolvedEvolutionKeyExists,
    gptmakerAgentId: effectiveConfig.gptmakerAgentId || '',
    gptmakerJwtToken: '',
    gptmakerJwtTokenSaved: hasGptToken,
    gptmakerJwtTokenPreview: hasGptToken ? effectiveConfig.gptmakerJwtToken!.slice(0, 8) + '••••••' : '',
    gptmakerDirectChannel: effectiveConfig.gptmakerDirectChannel ?? false,
    chatwootUrl: effectiveConfig.chatwootUrl || '',
    chatwootAccountId: effectiveConfig.chatwootAccountId || '',
    chatwootApiToken: '',
    chatwootApiTokenSaved: hasChatwootToken,
    chatwootApiTokenPreview: hasChatwootToken ? effectiveConfig.chatwootApiToken!.slice(0, 8) + '••••••' : '',
    chatwootInboxId: effectiveConfig.chatwootInboxId || '',
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
    const owner = await findOrgByEvolutionInstance(body.evolutionInstance)
    if (owner && owner !== orgId) {
      return NextResponse.json({ error: 'Essa instância já está em uso por outra organização. Escolha outro nome.' }, { status: 409 })
    }
    if (!body.evolutionApiKey) {
      const existing = await loadProviderConfig(orgId)
      body.evolutionApiKey = existing?.evolutionApiKey || ''
      // Sem chave própria a factory usa EVOLUTION_API_KEY (infra compartilhada) — UI já mostra "chave salva"
      if (!body.evolutionApiKey && !process.env.EVOLUTION_API_KEY) return NextResponse.json({ error: 'evolutionApiKey é obrigatório' }, { status: 400 })
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

  // Chatwoot: keep existing token if not sent
  if (!body.chatwootApiToken) {
    const existing = await loadProviderConfig(orgId)
    body.chatwootApiToken = existing?.chatwootApiToken || ''
  }

  // Preserve gptmakerChannelId from existing config if not sent
  let existingChannelId: string | undefined
  if (!body.gptmakerChannelId) {
    const existing = await loadProviderConfig(orgId)
    existingChannelId = existing?.gptmakerChannelId
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
    gptmakerDirectChannel: body.gptmakerDirectChannel ?? false,
    gptmakerChannelId: body.gptmakerChannelId || existingChannelId || '',
    chatwootUrl: body.chatwootUrl || '',
    chatwootAccountId: body.chatwootAccountId || '',
    chatwootApiToken: body.chatwootApiToken || '',
    chatwootInboxId: body.chatwootInboxId || '',
  }

  await saveProviderConfig(configToSave, orgId)
  return NextResponse.json({ success: true })
}
