/**
 * Meta WhatsApp Cloud API Provider
 * Official API — paid per message, no ban risk
 */

import type { IWhatsAppProvider, SendMessageOptions, SendTextResult, ConnectionStatus } from './types'

export class MetaProvider implements IWhatsAppProvider {
  readonly type = 'meta' as const

  constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string,
  ) {}

  async sendText({ phone, text }: SendMessageOptions): Promise<SendTextResult> {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v24.0/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: text },
          }),
        }
      )

      const data = await res.json()

      if (res.ok && data.messages?.[0]?.id) {
        return { success: true, messageId: data.messages[0].id }
      }

      return {
        success: false,
        error: data.error?.message || `HTTP ${res.status}`,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      }
    }
  }

  // Meta doesn't have a "connection" concept for bulk sending
  async getConnectionStatus(): Promise<ConnectionStatus> {
    if (!this.phoneNumberId || !this.accessToken) {
      return { connected: false }
    }
    try {
      const res = await fetch(
        `https://graph.facebook.com/v24.0/${this.phoneNumberId}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      )
      const data = await res.json()
      return {
        connected: res.ok,
        phone: data.display_phone_number,
        name: data.verified_name,
      }
    } catch {
      return { connected: false }
    }
  }
}
