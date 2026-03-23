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
  // Mask sensitive tokens before returning
  if (config?.accessToken) {
    config.accessToken = config.accessToken.slice(0, 8) + '***'
  }
  if (config?.evolutionApiKey) {
    config.evolutionApiKey = config.evolutionApiKey.slice(0, 6) + '***'
  }
  return NextResponse.json(config || { type: 'meta' })
}

export async function POST(req: NextRequest) {
  const { error } = await requireManager()
  if (error) return error

  const body: ProviderConfig = await req.json()

  if (!body.type || !['meta', 'evolution'].includes(body.type)) {
    return NextResponse.json({ error: 'type deve ser "meta" ou "evolution"' }, { status: 400 })
  }

  if (body.type === 'evolution') {
    if (!body.evolutionUrl) return NextResponse.json({ error: 'evolutionUrl é obrigatório' }, { status: 400 })
    if (!body.evolutionApiKey) return NextResponse.json({ error: 'evolutionApiKey é obrigatório' }, { status: 400 })
    if (!body.evolutionInstance) return NextResponse.json({ error: 'evolutionInstance é obrigatório' }, { status: 400 })
  }

  await saveProviderConfig(body)
  return NextResponse.json({ success: true })
}
