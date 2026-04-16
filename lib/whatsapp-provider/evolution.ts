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

  /** Ensure the instance exists, creating it if needed. Returns QR from create response if available. */
  private async ensureInstance(): Promise<string | undefined> {
    try {
      const check = await fetch(
        `${this.baseUrl}/instance/connectionState/${this.instance}`,
        { headers: this.headers }
      )
      if (check.status === 404) {
        // Instance doesn't exist — create it
        const createRes = await fetch(`${this.baseUrl}/instance/create`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            instanceName: this.instance,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        })
        if (createRes.ok) {
          const createData = await createRes.json()
          // Some versions return QR code directly in the create response
          const qr = createData.qrcode?.base64 || createData.base64 || createData.qrCode
          if (qr) return qr
        } else {
          const body = await createRes.text().catch(() => '')
          console.warn(`[Evolution] create instance failed ${createRes.status}: ${body.slice(0, 300)}`)
        }
      }
    } catch (e) {
      console.warn('[Evolution] ensureInstance error:', e)
    }
    return undefined
  }

  /** Fetch QR code from the Evolution API */
  private async fetchQrCode(): Promise<string | undefined> {
    try {
      // Try v2 connect endpoint
      const res = await fetch(
        `${this.baseUrl}/instance/connect/${this.instance}`,
        { headers: this.headers }
      )

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.warn(`[Evolution] fetchQrCode /connect ${res.status}: ${body.slice(0, 300)}`)
        return undefined
      }

      const data = await res.json()

      // v2: { code: "...", base64: "data:image/png;base64,..." }
      // v1: { qrcode: { base64: "..." } }
      const qr = data.base64 || data.qrcode?.base64 || data.qrCode

      if (qr) return qr

      // Fallback: fetchInstances (some versions embed QR there)
      const res2 = await fetch(
        `${this.baseUrl}/instance/fetchInstances`,
        { headers: this.headers }
      )
      if (res2.ok) {
        const instances = await res2.json()
        const inst = Array.isArray(instances)
          ? instances.find((i: any) => i.instance?.instanceName === this.instance || i.instanceName === this.instance)
          : null
        const qr2 = inst?.instance?.qrcode?.base64 || inst?.qrcode?.base64
        if (qr2) return qr2
      }

      console.warn('[Evolution] fetchQrCode: no QR found in response:', JSON.stringify(data).slice(0, 300))
      return undefined
    } catch (e) {
      console.warn('[Evolution] fetchQrCode error:', e)
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
      // Ensure instance exists before checking state (may return QR from create response)
      const qrFromCreate = await this.ensureInstance()

      const res = await fetch(
        `${this.baseUrl}/instance/connectionState/${this.instance}`,
        { headers: this.headers }
      )

      if (!res.ok) {
        const qrCode = qrFromCreate || await this.fetchQrCode()
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

      // Not connected — get QR code (prefer QR from create if fresh)
      const qrCode = qrFromCreate || await this.fetchQrCode()
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

  /** Clear stale session and generate a fresh QR code */
  async forceReconnect(): Promise<ConnectionStatus> {
    // Logout to clear any stale WhatsApp session (non-fatal)
    await fetch(
      `${this.baseUrl}/instance/logout/${this.instance}`,
      { method: 'DELETE', headers: this.headers }
    ).catch(() => {})

    // Give Evolution time to process the logout
    await sleep(800)

    const qrCode = await this.fetchQrCode()
    return {
      connected: false,
      state: qrCode ? 'connecting' : 'error',
      qrCode,
      error: qrCode
        ? undefined
        : 'Não foi possível gerar o QR code. Verifique a URL e a API key do Evolution.',
    }
  }

  /** Check which numbers have active WhatsApp accounts.
   *  Returns a Set of valid phone numbers (digits only).
   *  Falls back to treating all as valid if the API fails.
   */
  async checkNumbers(phones: string[]): Promise<Set<string>> {
    if (!phones.length) return new Set()
    const cleanPhones = phones.map(p => p.replace(/\D/g, ''))
    // Try primary endpoint, then fallback (endpoint varies between Evolution API versions)
    const endpoints = [
      `${this.baseUrl}/chat/whatsappNumbers/${this.instance}`,
      `${this.baseUrl}/chat/checkIsWhatsapp/${this.instance}`,
    ]
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({ numbers: cleanPhones }),
        })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          console.warn(`[Evolution] checkNumbers ${url} → ${res.status}: ${body.slice(0, 200)}`)
          continue // try next endpoint
        }
        const data = await res.json()
        const valid = new Set<string>()
        for (const item of Array.isArray(data) ? data : []) {
          if (item.exists) {
            const num = (item.jid as string | undefined)?.split('@')[0] || (item.number as string | undefined) || ''
            if (num) {
              valid.add(num)
              valid.add(`+${num}`)
            }
          }
        }
        console.log(`[Evolution] checkNumbers via ${url}: ${valid.size / 2}/${phones.length} valid`)
        return valid
      } catch (e) {
        console.warn(`[Evolution] checkNumbers ${url} threw:`, e)
      }
    }
    console.warn('[Evolution] checkNumbers: all endpoints failed — treating all as valid')
    return new Set(phones)
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
