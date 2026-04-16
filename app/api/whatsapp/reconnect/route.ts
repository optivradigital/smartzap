/**
 * API: Force WhatsApp Reconnect (Evolution only)
 * POST — faz logout da sessão atual e gera novo QR code
 */

import { NextResponse } from 'next/server'
import { createWhatsAppProvider } from '@/lib/whatsapp-provider/factory'
import { requireManager } from '@/lib/role-guard'
import { getCurrentUser } from '@/lib/multi-user-auth'
import { EvolutionProvider } from '@/lib/whatsapp-provider/evolution'

export async function POST() {
  const { error: authError } = await requireManager()
  if (authError) return authError

  try {
    const user = await getCurrentUser()
    const orgId = user?.organizationId

    const provider = await createWhatsAppProvider(orgId)

    if (!(provider instanceof EvolutionProvider)) {
      return NextResponse.json(
        { error: 'Reconnect disponível apenas para Evolution API' },
        { status: 400 }
      )
    }

    const status = await provider.forceReconnect()
    return NextResponse.json(status)
  } catch (err) {
    return NextResponse.json({
      connected: false,
      error: err instanceof Error ? err.message : 'Erro ao reconectar',
    })
  }
}
