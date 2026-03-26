/**
 * API: WhatsApp Provider Settings
 * GET  — retorna config atual (manager+)
 * POST — salva nova config (manager+)
 */

import { NextRequest, NextResponse } from 'next/server'
import { saveProviderConfig, loadProviderConfig } from '@/lib/whatsapp-provider/factory'
import { requireManager } from '@/lib/role-guard'
import type { ProviderConfig } from '@/lib/whatsapp-provider/types'

export async function GET() {
  const { error } = await requireManager()
  if (error) return error

  const config = await loadProviderConfig()

  if (!config) return NextResponse.json({ type: 'meta' })

  // IMPORTANT: never return the real token — return a flag + preview only
  // This prevents the masked version from being re-saved on next Save click
  const hasToken = !!(config.accessToken)
  const hasEvolutionKey = !!(config.evolutionApiKey)

  return NextResponse.json({
    type: config.type || 'meta',
    phoneNumberId: config.phoneNumberId || '',
    businessAccountId: config.businessAccountId || '',
    // Don't return accessToken — use tokenSaved flag instead
    accessToken: '',
    tokenSaved: hasToken,
    tokenPreview: hasToken ? config.accessToken!.slice(0, 8) + '••••••' : '',
    evolutionUrl: config.evolutionUrl || '',
    evolutionInstance: config.evolutionInstance || '',
    evolutionApiKey: '',
    evolutionKeySaved: hasEvolutionKey,
  })
}

export async function POST(req: NextRequest) {
  const { error } = await requireManager()
  if (error) return error

  const body: ProviderConfig & { tokenSaved?: boolean; evolutionKeySaved?: boolean } = await req.json()

  if (!body.type || !['meta', 'evolution'].includes(body.type)) {
    return NextResponse.json({ error: 'type deve ser "meta" ou "evolution"' }, { status: 400 })
  }

  if (body.type === 'evolution') {
    if (!body.evolutionUrl) return NextResponse.json({ error: 'evolutionUrl é obrigatório' }, { status: 400 })
    if (!body.evolutionInstance) return NextResponse.json({ error: 'evolutionInstance é obrigatório' }, { status: 400 })
    // If no new key provided, keep existing
    if (!body.evolutionApiKey) {
      const existing = await loadProviderConfig()
      body.evolutionApiKey = existing?.evolutionApiKey || ''
      if (!body.evolutionApiKey) return NextResponse.json({ error: 'evolutionApiKey é obrigatório' }, { status: 400 })
    }
  }

  if (body.type === 'meta') {
    if (!body.phoneNumberId) return NextResponse.json({ error: 'phoneNumberId é obrigatório' }, { status: 400 })
    // If no new token provided, keep the existing one from Redis
    if (!body.accessToken) {
      const existing = await loadProviderConfig()
      body.accessToken = existing?.accessToken || ''
      if (!body.accessToken) return NextResponse.json({ error: 'accessToken é obrigatório' }, { status: 400 })
    }
  }

  // Save (also syncs to settings:whatsapp:credentials)
  const configToSave: ProviderConfig = {
    type: body.type,
    phoneNumberId: body.phoneNumberId,
    businessAccountId: body.businessAccountId,
    accessToken: body.accessToken,
    evolutionUrl: body.evolutionUrl,
    evolutionApiKey: body.evolutionApiKey,
    evolutionInstance: body.evolutionInstance,
  }

  await saveProviderConfig(configToSave)
  return NextResponse.json({ success: true })
}
