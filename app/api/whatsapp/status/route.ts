/**
 * API: WhatsApp Connection Status
 * GET — retorna status de conexão (e QR code se Evolution + desconectado)
 */

import { NextResponse } from 'next/server'
import { createWhatsAppProvider } from '@/lib/whatsapp-provider/factory'
import { requireManager } from '@/lib/role-guard'
import { getCurrentUser } from '@/lib/clerk-auth'
import { EvolutionProvider } from '@/lib/whatsapp-provider/evolution'

export async function GET() {
  const { error: authError } = await requireManager()
  if (authError) return authError

  try {
    const user = await getCurrentUser()
    const orgId = user?.organizationId

    // If org has no credentials saved, check env vars before giving up
    const { loadProviderConfig } = await import('@/lib/whatsapp-provider/factory')
    const config = await loadProviderConfig(orgId)
    const hasEnvEvolution = !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY)
    const hasEnvMeta = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID)
    if (!config || (!config.phoneNumberId && !config.evolutionUrl)) {
      if (!hasEnvEvolution && !hasEnvMeta) {
        return NextResponse.json({ connected: false, notConfigured: true })
      }
    }

    const provider = await createWhatsAppProvider(orgId)
    const status = await provider.getConnectionStatus()

    // Auto-configure Evolution webhook when connected so delivery ACKs arrive
    if (status.connected && provider instanceof EvolutionProvider) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      if (appUrl) {
        provider.configureWebhook(appUrl).catch(() => {})
      }
    }

    return NextResponse.json({ provider: provider.type, ...status })
  } catch (err) {
    return NextResponse.json({
      connected: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    })
  }
}
