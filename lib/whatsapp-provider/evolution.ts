/**
 * Evolution API Provider (unofficial WhatsApp via Baileys)
 * Free per message — requires QR code scan, anti-ban measures recommended
 * Supports Evolution API v1 and v2
 */

import type { IWhatsAppProvider, SendMessageOptions, SendTextResult, ConnectionStatus } from './types'

export class EvolutionProvider implements IWhatsAppProvider {
  readonly type = 'evolution' as const

  constructor(
    private readonly baseUrl: string,   // ex: https://evolution.optivra.digital
    private readonly apiKey: string,
    private readonly instance: string,  // ex: SmartZap
  ) {}

  private get headers() {
    return {
      apikey: this.apiKey,
      'Content-Type': 'application/json',
    }
  }

  private formatPhone(phone: string): string {
    return phone.replace(/\D/g, '')
  }

  /** Ensure the instance exists, creating it if needed */
  private async ensureInstance(): Promise<void> {
    try {
      const check = await fetch(
        `${this.baseUrl}/instance/connectionState/${this.instance}`,
        { headers: this.headers }
      )
      if (check.status === 404) {
        // Instance doesn't exist — create it
        await fetch(`${this.baseUrl}/instance/create`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            instanceName: this.instance,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        })
      }
    } catch {
      // Non-fatal — proceed anyway
    }
  }

  /** Fetch QR code from the Evolution API */
  private async fetchQrCode(): Promise<string | undefined> {
    try {
      // Try v2 connect endpoint
      const res = await fetch(
        `${this.baseUrl}/instance/connect/${this.instance}`,
        { headers: this.headers }
      )
      const data = await res.json()

      // v2: { code: "...", base64: "data:image/png;base64,..." }
      // v1: { qrcode: { base64: "..." } }
      const qr = data.base64 || data.code || data.qrcode?.base64 || data.qrCode

      if (qr) return qr

      // Alternative: fetchQrCode endpoint (some versions)
      const res2 = await fetch(
        `${this.baseUrl}/instance/fetchInstances`,
        { headers: this.headers }
      )
      const instances = await res2.json()
      const inst = Array.isArray(instances)
        ? instances.find((i: any) => i.instance?.instanceName === this.instance || i.instanceName === this.instance)
        : null
      return inst?.instance?.qrcode?.base64 || inst?.qrcode?.base64 || undefined
    } catch {
      return undefined
    }
  }

  async sendText({ phone, text, simulateTyping = false, typingDurationMs = 1500 }: SendMessageOptions): Promise<SendTextResult> {
    const formattedPhone = this.formatPhone(phone)

    try {
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
            delay: 0,
          }),
        }
      )

      const data = await res.json()

      if (res.ok && (data.key?.id || data.messageId || data.id)) {
        return { success: true, messageId: data.key?.id || data.messageId || data.id }
      }

      return {
        success: false,
        error: data.response?.message?.[0]?.message || data.message || data.error || `HTTP ${res.status}`,
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
      // Non-fatal
    }
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    try {
      // Ensure instance exists before checking state
      await this.ensureInstance()

      const res = await fetch(
        `${this.baseUrl}/instance/connectionState/${this.instance}`,
        { headers: this.headers }
      )

      if (!res.ok) {
        const qrCode = await this.fetchQrCode()
        return { connected: false, state: 'connecting', qrCode }
      }

      const data = await res.json()
      // v2: { instance: { state: "open" } } | v1: { state: "open" }
      const state: string = data.instance?.state || data.state || 'close'

      if (state === 'open') {
        // Fetch connected number info
        try {
          const infoRes = await fetch(
            `${this.baseUrl}/instance/fetchInstances`,
            { headers: this.headers }
          )
          const instances = await infoRes.json()
          const inst = Array.isArray(instances)
            ? instances.find((i: any) =>
                i.instance?.instanceName === this.instance ||
                i.instanceName === this.instance
              )
            : null

          const owner = inst?.instance?.owner || inst?.owner || ''
          const profileName = inst?.instance?.profileName || inst?.profileName || ''

          return {
            connected: true,
            state: 'open',
            phone: owner.replace('@s.whatsapp.net', '') || undefined,
            name: profileName || undefined,
          }
        } catch {
          return { connected: true, state: 'open' }
        }
      }

      // Not connected — get QR code
      const qrCode = await this.fetchQrCode()
      return { connected: false, state, qrCode }

    } catch (err) {
      return {
        connected: false,
        state: 'error',
        error: err instanceof Error ? err.message : 'Erro ao conectar com Evolution API',
      }
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
