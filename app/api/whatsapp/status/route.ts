/**
 * API: WhatsApp Connection Status
 * GET — retorna status de conexão (e QR code se Evolution + desconectado)
 */

import { NextResponse } from 'next/server'
import { createWhatsAppProvider } from '@/lib/whatsapp-provider/factory'
import { requireManager } from '@/lib/role-guard'
import { getCurrentUser } from '@/lib/multi-user-auth'

export async function GET() {
  const { error: authError } = await requireManager()
  if (authError) return authError

  try {
    const user = await getCurrentUser()
    const orgId = user?.organizationId

    // If org has no credentials saved, return not-configured (don't fall back to env/global)
    const { loadProviderConfig } = await import('@/lib/whatsapp-provider/factory')
    const config = await loadProviderConfig(orgId)
    if (!config || (!config.phoneNumberId && !config.evolutionUrl)) {
      return NextResponse.json({ connected: false, notConfigured: true })
    }

    const provider = await createWhatsAppProvider(orgId)
    const status = await provider.getConnectionStatus()
    return NextResponse.json({ provider: provider.type, ...status })
  } catch (err) {
    return NextResponse.json({
      connected: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    })
  }
}
