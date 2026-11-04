import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = new Map<string, string>()
vi.mock('@/lib/redis', () => ({
  redis: {
    get: async (k: string) => (store.has(k) ? JSON.parse(store.get(k)!) : null),
    set: async (k: string, v: unknown) => { store.set(k, JSON.stringify(v)); return 'OK' },
    keys: async (p: string) => [...store.keys()].filter(k => k.startsWith(p.replace('*', ''))),
  },
}))

import { loadProviderConfig, createWhatsAppProvider, findOrgByEvolutionInstance } from '@/lib/whatsapp-provider/factory'

beforeEach(() => {
  store.clear()
  process.env.EVOLUTION_API_URL = 'http://evo'
  process.env.EVOLUTION_API_KEY = 'k'
  process.env.EVOLUTION_INSTANCE = 'SmartZap'
  process.env.WHATSAPP_TOKEN = 'tok'
  process.env.WHATSAPP_PHONE_ID = '123'
})

describe('isolamento WhatsApp por org', () => {
  it('org sem config não herda a config global', async () => {
    store.set('whatsapp:provider:config', JSON.stringify({ type: 'evolution', evolutionInstance: 'SmartZap' }))
    expect(await loadProviderConfig('org_nova')).toBeNull()
  })

  it('org sem config não cai no número do .env', async () => {
    await expect(createWhatsAppProvider('org_nova')).rejects.toThrow(/não configurado/)
  })

  it('org evolution sem instância não usa a instância default', async () => {
    store.set('whatsapp:provider:config:org_a', JSON.stringify({ type: 'evolution' }))
    await expect(createWhatsAppProvider('org_a')).rejects.toThrow()
  })

  it('sem org (legado) ainda usa o .env', async () => {
    const p = await createWhatsAppProvider(null)
    expect(p.type).toBe('evolution')
  })

  it('findOrgByEvolutionInstance ignora configs meta com instância antiga', async () => {
    store.set('whatsapp:provider:config:org_meta', JSON.stringify({ type: 'meta', evolutionInstance: 'SmartZap' }))
    store.set('whatsapp:provider:config:org_evo', JSON.stringify({ type: 'evolution', evolutionInstance: 'SmartZap' }))
    expect(await findOrgByEvolutionInstance('SmartZap')).toBe('org_evo')
  })
})
