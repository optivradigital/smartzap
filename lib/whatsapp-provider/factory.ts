/**
 * WhatsApp Provider Factory
 * Cria o provider certo baseado nas configurações salvas no Redis/env
 */

import { MetaProvider } from './meta'
import { EvolutionProvider } from './evolution'
import type { IWhatsAppProvider, ProviderConfig, WhatsAppProviderType } from './types'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { redis } from '@/lib/redis'

const PROVIDER_CONFIG_KEY = 'whatsapp:provider:config'

// ── Persistência ──────────────────────────────────────────────────────────────

export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  await redis.set(PROVIDER_CONFIG_KEY, JSON.stringify(config))
}

export async function loadProviderConfig(): Promise<ProviderConfig | null> {
  try {
    const raw = await redis.get(PROVIDER_CONFIG_KEY)
    if (!raw) return null
    return JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)) as ProviderConfig
  } catch {
    return null
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export async function createWhatsAppProvider(): Promise<IWhatsAppProvider> {
  const config = await loadProviderConfig()
  const providerType: WhatsAppProviderType = (config?.type) || 'meta'

  if (providerType === 'evolution') {
    const url = config?.evolutionUrl || process.env.EVOLUTION_API_URL || ''
    const key = config?.evolutionApiKey || process.env.EVOLUTION_API_KEY || ''
    const instance = config?.evolutionInstance || process.env.EVOLUTION_INSTANCE || 'SmartZap'

    if (!url || !key) {
      throw new Error('Evolution API não configurada. Acesse Configurações → WhatsApp.')
    }

    return new EvolutionProvider(url, key, instance)
  }

  // Default: Meta Cloud API
  const redisCredentials = await getWhatsAppCredentials()
  const phoneNumberId =
    config?.phoneNumberId ||
    redisCredentials?.phoneNumberId ||
    process.env.WHATSAPP_PHONE_ID ||
    process.env.WHATSAPP_PHONE_NUMBER_ID || ''

  const accessToken =
    config?.accessToken ||
    redisCredentials?.accessToken ||
    process.env.WHATSAPP_TOKEN || ''

  if (!phoneNumberId || !accessToken) {
    throw new Error('Credenciais Meta não configuradas. Acesse Configurações → WhatsApp.')
  }

  return new MetaProvider(phoneNumberId, accessToken)
}

export { MetaProvider, EvolutionProvider }
export type { IWhatsAppProvider, ProviderConfig, WhatsAppProviderType }
