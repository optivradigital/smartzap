/**
 * POST /api/whatsapp/disconnect
 * Desconecta a instância Evolution API (logout real).
 */

import { NextResponse } from 'next/server'
import { requireManager } from '@/lib/role-guard'
import { getCurrentUser } from '@/lib/clerk-auth'
import { loadProviderConfig } from '@/lib/whatsapp-provider/factory'

export async function POST() {
  const { error } = await requireManager()
  if (error) return error

  const user = await getCurrentUser()
  const orgId = user?.organizationId

  const config = await loadProviderConfig(orgId)

  if (!config || config.type !== 'evolution') {
    return NextResponse.json({ error: 'Apenas Evolution API suporta disconnect via QR' }, { status: 400 })
  }

  const { evolutionUrl, evolutionApiKey, evolutionInstance } = config

  if (!evolutionUrl || !evolutionApiKey || !evolutionInstance) {
    return NextResponse.json({ error: 'Configuração Evolution incompleta' }, { status: 400 })
  }

  const res = await fetch(
    `${evolutionUrl.replace(/\/$/, '')}/instance/logout/${evolutionInstance}`,
    {
      method: 'DELETE',
      headers: { apikey: evolutionApiKey },
    }
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[Disconnect] Evolution logout error:', res.status, text.slice(0, 200))
    return NextResponse.json({ error: 'Erro ao desconectar na Evolution API', status: res.status }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
