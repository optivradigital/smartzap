/**
 * Evolution API Provider (unofficial WhatsApp via Baileys)
 * Free per message — requires QR code scan, anti-ban measures recommended
 */

import type { IWhatsAppProvider, SendMessageOptions, SendTextResult, ConnectionStatus } from './types'

export class EvolutionProvider implements IWhatsAppProvider {
  readonly type = 'evolution' as const

  constructor(
    private readonly baseUrl: string,   // ex: https://evolution.optivra.digital
    private readonly apiKey: string,
    private readonly instance: string,  // ex: Ademicon
  ) {}

  private get headers() {
    return {
      apikey: this.apiKey,
      'Content-Type': 'application/json',
    }
  }

  private formatPhone(phone: string): string {
    // Normaliza para formato internacional sem + e sem caracteres especiais
    return phone.replace(/\D/g, '')
  }

  async sendText({ phone, text, simulateTyping = false, typingDurationMs = 1500 }: SendMessageOptions): Promise<SendTextResult> {
    const formattedPhone = this.formatPhone(phone)

    try {
      // Simula "digitando..." antes de enviar (anti-ban + experiência mais natural)
      if (simulateTyping) {
        await this.sendTyping(formattedPhone, typingDurationMs)
        await sleep(typingDurationMs)
      }

      const res = await fetch(
        `${this.baseUrl}/message/sendText/${this.instance}`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            number: formattedPhone,
            text,
            delay: 0, // delay já gerenciado pelo worker
          }),
        }
      )

      const data = await res.json()

      if (res.ok && data.key?.id) {
        return { success: true, messageId: data.key.id }
      }

      return {
        success: false,
        error: data.response?.message?.[0]?.message || data.message || `HTTP ${res.status}`,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      }
    }
  }

  private async sendTyping(phone: string, durationMs: number): Promise<void> {
    try {
      await fetch(
        `${this.baseUrl}/chat/presence/${this.instance}`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            number: phone,
            options: { delay: durationMs, presence: 'composing' },
          }),
        }
      )
    } catch {
      // Typing simulation failure is non-fatal
    }
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    try {
      const res = await fetch(
        `${this.baseUrl}/instance/connectionState/${this.instance}`,
        { headers: this.headers }
      )

      if (!res.ok) {
        // Tenta buscar QR code se não conectado
        const qrRes = await fetch(
          `${this.baseUrl}/instance/connect/${this.instance}`,
          { headers: this.headers }
        )
        const qrData = await qrRes.json()
        return {
          connected: false,
          state: 'connecting',
          qrCode: qrData.base64 || qrData.qrcode?.base64,
        }
      }

      const data = await res.json()
      const state = data.instance?.state || data.state

      if (state === 'open') {
        // Busca info do número conectado
        try {
          const infoRes = await fetch(
            `${this.baseUrl}/instance/fetchInstances`,
            { headers: this.headers }
          )
          const instances = await infoRes.json()
          const inst = Array.isArray(instances)
            ? instances.find((i: Record<string, unknown>) => i.instance?.instanceName === this.instance)
            : null

          return {
            connected: true,
            state: 'open',
            phone: inst?.instance?.owner?.replace('@s.whatsapp.net', '') || undefined,
            name: inst?.instance?.profileName || undefined,
          }
        } catch {
          return { connected: true, state: 'open' }
        }
      }

      // Not connected — return QR code
      const qrRes = await fetch(
        `${this.baseUrl}/instance/connect/${this.instance}`,
        { headers: this.headers }
      )
      const qrData = await qrRes.json()

      return {
        connected: false,
        state,
        qrCode: qrData.base64 || qrData.qrcode?.base64,
      }
    } catch (err) {
      return { connected: false, state: 'error' }
    }
  }

  async disconnect(): Promise<void> {
    await fetch(
      `${this.baseUrl}/instance/logout/${this.instance}`,
      { method: 'DELETE', headers: this.headers }
    )
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
