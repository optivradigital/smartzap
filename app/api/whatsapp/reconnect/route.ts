/**
 * API: Force WhatsApp Reconnect (Evolution only)
 * POST — faz logout da sessão atual e gera novo QR code
 */

import { NextResponse } from 'next/server'
import { createWhatsAppProvider } from '@/lib/whatsapp-provider/factory'
import { requireManager } from '@/lib/role-guard'
import { getCurrentUser } from '@/lib/clerk-auth'
import { EvolutionProvider } from '@/lib/whatsapp-provider/evolution'

export async function POST() {
  const { error: authError } = await requireManager()
  if (authError) return authError

  try {
    const user = await getCurrentUser()
    const orgId = user?.organizationId

    // createWhatsAppProvider uses Redis config OR env vars (EVOLUTION_API_URL etc.)
    const provider = await createWhatsAppProvider(orgId)

    if (provider.type !== 'evolution') {
      return NextResponse.json(
        { error: 'Preencha e salve as credenciais do Evolution API (URL + API Key) primeiro.' },
        { status: 400 }
      )
    }

    const status = await (provider as EvolutionProvider).forceReconnect()
    return NextResponse.json(status)
  } catch (err) {
    return NextResponse.json({
      connected: false,
      error: err instanceof Error ? err.message : 'Erro ao reconectar',
    })
  }
}
