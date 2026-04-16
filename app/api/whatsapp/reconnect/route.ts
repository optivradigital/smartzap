/**
 * API: Force WhatsApp Reconnect (Evolution only)
 * POST — faz logout da sessão atual e gera novo QR code
 */

import { NextResponse } from 'next/server'
import { createWhatsAppProvider, loadProviderConfig } from '@/lib/whatsapp-provider/factory'
import { requireManager } from '@/lib/role-guard'
import { getCurrentUser } from '@/lib/multi-user-auth'
import { EvolutionProvider } from '@/lib/whatsapp-provider/evolution'

export async function POST() {
  const { error: authError } = await requireManager()
  if (authError) return authError

  try {
    const user = await getCurrentUser()
    const orgId = user?.organizationId

    // Check config before creating provider to give a clear error message
    const config = await loadProviderConfig(orgId)
    if (!config || config.type !== 'evolution') {
      return NextResponse.json(
        { error: 'Preencha e salve as credenciais do Evolution API (URL + API Key) primeiro.' },
        { status: 400 }
      )
    }
    if (!config.evolutionUrl || !config.evolutionApiKey) {
      return NextResponse.json(
        { error: 'Credenciais do Evolution incompletas. Preencha a URL e a API Key e salve.' },
        { status: 400 }
      )
    }

    const provider = await createWhatsAppProvider(orgId)

    if (provider.type !== 'evolution') {
      return NextResponse.json(
        { error: 'Configuração Evolution não carregada corretamente. Tente salvar as credenciais novamente.' },
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
