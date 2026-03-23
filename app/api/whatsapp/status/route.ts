/**
 * API: WhatsApp Connection Status
 * GET — retorna status de conexão (e QR code se Evolution + desconectado)
 */

import { NextResponse } from 'next/server'
import { createWhatsAppProvider } from '@/lib/whatsapp-provider/factory'
import { requireManager } from '@/lib/role-guard'

export async function GET() {
  const { error: authError } = await requireManager()
  if (authError) return authError

  try {
    const provider = await createWhatsAppProvider()
    const status = await provider.getConnectionStatus()
    return NextResponse.json({ provider: provider.type, ...status })
  } catch (err) {
    return NextResponse.json({
      connected: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    })
  }
}
