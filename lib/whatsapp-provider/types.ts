/**
 * WhatsApp Provider Abstraction
 * Supports: Meta Cloud API (official) + Evolution API (unofficial, via Baileys)
 */

export type WhatsAppProviderType = 'meta' | 'evolution'

export interface SendTextResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface ConnectionStatus {
  connected: boolean
  phone?: string
  name?: string
  qrCode?: string        // base64, only when connecting via Evolution
  state?: string         // 'open' | 'connecting' | 'close' | 'error'
  error?: string         // error message when state is 'error'
}

export interface ProviderConfig {
  type: WhatsAppProviderType
  // Meta
  phoneNumberId?: string
  businessAccountId?: string
  accessToken?: string
  // Evolution
  evolutionUrl?: string
  evolutionApiKey?: string
  evolutionInstance?: string
  // GPT Maker integration
  gptmakerAgentId?: string
  gptmakerJwtToken?: string
  gptmakerJwtTokenSaved?: boolean
  gptmakerJwtTokenPreview?: string
  // Quando true, GPT Maker tem canal WhatsApp direto e responde às mensagens.
  // SmartZap só registra contexto de campanhas e rastreia status de entrega.
  gptmakerDirectChannel?: boolean
  // ID do canal WhatsApp no GPTMaker (CLOUD_API). context_id do add-message é "{channelId}-{phone}"
  gptmakerChannelId?: string
  // Chatwoot integration (Agent Bot)
  chatwootUrl?: string
  chatwootAccountId?: string
  chatwootApiToken?: string
  chatwootApiTokenSaved?: boolean
  chatwootApiTokenPreview?: string
  chatwootInboxId?: string
  chatwootTeamId?: string
  chatwootAssigneeId?: string  // Chatwoot agent ID to assign when humanizing (e.g. Mariane)
  // Agent routing map: { default: rockyId, constansa: constansaId, demi: demiId, ... }
  agentRouting?: Record<string, string>
}

export interface SendMessageOptions {
  phone: string
  text: string
  simulateTyping?: boolean    // sends typing indicator before message (Evolution only)
  typingDurationMs?: number   // how long to show "typing..." (default 1500ms)
}

export interface IWhatsAppProvider {
  type: WhatsAppProviderType
  sendText(options: SendMessageOptions): Promise<SendTextResult>
  getConnectionStatus(): Promise<ConnectionStatus>
}
