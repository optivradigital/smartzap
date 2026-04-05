'use client'

/**
 * WhatsApp Provider Settings
 * Permite ao usuário escolher entre Meta Cloud API e Evolution API (via QR code)
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Smartphone, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle, Loader2, Save, QrCode, Zap, Shield, KeyRound, MessageSquare, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type ProviderType = 'meta' | 'evolution'

interface ProviderConfig {
  type: ProviderType
  phoneNumberId?: string
  businessAccountId?: string
  accessToken?: string
  tokenSaved?: boolean
  tokenPreview?: string
  evolutionUrl?: string
  evolutionApiKey?: string
  evolutionKeySaved?: boolean
  evolutionInstance?: string
  gptmakerAgentId?: string
  gptmakerJwtToken?: string
  gptmakerJwtTokenSaved?: boolean
  gptmakerJwtTokenPreview?: string
  gptmakerDirectChannel?: boolean
  chatwootUrl?: string
  chatwootAccountId?: string
  chatwootApiToken?: string
  chatwootApiTokenSaved?: boolean
  chatwootApiTokenPreview?: string
  chatwootInboxId?: string
}

interface ConnectionStatus {
  connected: boolean
  provider?: string
  phone?: string
  name?: string
  qrCode?: string
  state?: string
  error?: string
}

export function WhatsAppProviderSettings() {
  const [config, setConfig] = useState<ProviderConfig>({ type: 'meta' })
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshingQR, setRefreshingQR] = useState(false)
  const { user } = useCurrentUser()

  const fetchConfig = useCallback(async () => {
    const res = await fetch('/api/whatsapp/provider')
    if (res.ok) setConfig(await res.json())
  }, [])

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/whatsapp/status')
      if (res.ok) setStatus(await res.json())
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchConfig(), fetchStatus()]).finally(() => setLoading(false))
  }, [fetchConfig, fetchStatus])

  // Polling para QR code atualizado enquanto aguarda scan (Evolution)
  useEffect(() => {
    if (config.type !== 'evolution' || status?.connected) return
    if (!status?.qrCode) return
    const interval = setInterval(() => fetchStatus(true), 5000)
    return () => clearInterval(interval)
  }, [config.type, status?.connected, status?.qrCode, fetchStatus])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: ProviderConfig = { ...config }

      const res = await fetch('/api/whatsapp/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success('Configuração salva!')
        await Promise.all([fetchConfig(), fetchStatus()])
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erro ao salvar')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleRefreshQR = async () => {
    setRefreshingQR(true)
    await fetchStatus()
    setRefreshingQR(false)
  }

  return (
    <div className="space-y-6">

      {/* Provider selector */}
      <div>
        <label className="block text-sm font-semibold text-white mb-3">
          Tipo de Conexão WhatsApp
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          <button
            type="button"
            onClick={() => setConfig(c => ({ ...c, type: 'meta' }))}
            className={`relative flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all ${
              config.type === 'meta'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield size={18} className={config.type === 'meta' ? 'text-blue-400' : 'text-gray-400'} />
              <span className="font-semibold text-sm text-white">Meta Cloud API</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">Oficial</span>
            </div>
            <p className="text-xs text-gray-400">
              API oficial do WhatsApp Business. Mensagens cobradas. Templates precisam de aprovação do Meta.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setConfig(c => ({ ...c, type: 'evolution' }))}
            className={`relative flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all ${
              config.type === 'evolution'
                ? 'border-green-500 bg-green-500/10'
                : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap size={18} className={config.type === 'evolution' ? 'text-green-400' : 'text-gray-400'} />
              <span className="font-semibold text-sm text-white">WhatsApp Business App</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">Gratuito</span>
            </div>
            <p className="text-xs text-gray-400">
              Conecta via QR code. Sem custo por mensagem. Textos livres sem aprovação prévia.
            </p>
          </button>

        </div>
      </div>

      {/* Meta settings */}
      {config.type === 'meta' && (
        <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
          <h4 className="text-sm font-semibold text-white">Credenciais Meta</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Phone Number ID</label>
              <input
                type="text"
                value={config.phoneNumberId || ''}
                onChange={e => setConfig(c => ({ ...c, phoneNumberId: e.target.value }))}
                placeholder="Ex: 123456789012345"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">WhatsApp Business Account ID (WABA)</label>
              <input
                type="text"
                value={config.businessAccountId || ''}
                onChange={e => setConfig(c => ({ ...c, businessAccountId: e.target.value }))}
                placeholder="Ex: 100093114169276"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Encontre em: Meta Business Manager → Contas → WhatsApp</p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1.5">
                Access Token
                {config.tokenSaved && (
                  <span className="flex items-center gap-1 text-green-400 text-xs font-normal">
                    <KeyRound size={11} /> Token salvo — deixe vazio para manter o atual
                  </span>
                )}
              </label>
              <input
                type="password"
                value={config.accessToken || ''}
                onChange={e => setConfig(c => ({ ...c, accessToken: e.target.value }))}
                placeholder={config.tokenSaved ? `Token atual: ${config.tokenPreview} (cole um novo para substituir)` : 'EAAxxxxxx...'}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Meta Connection Status */}
          <div className="pt-3 border-t border-white/10">
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 size={13} className="animate-spin" />
                Verificando conexão...
              </div>
            ) : status?.connected ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400 font-medium">Conectado</span>
                {status.name && <span className="text-xs text-gray-400">· {status.name}</span>}
                {status.phone && <span className="text-xs text-gray-400">· {status.phone}</span>}
                <button
                  onClick={() => fetchStatus()}
                  className="ml-auto text-gray-500 hover:text-white transition-colors"
                  title="Atualizar status"
                >
                  <RefreshCw size={11} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-xs text-red-400 font-medium">
                  {status?.error || 'Não conectado — verifique as credenciais'}
                </span>
                <button
                  onClick={() => fetchStatus()}
                  className="ml-auto text-gray-500 hover:text-white transition-colors"
                  title="Tentar novamente"
                >
                  <RefreshCw size={11} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Evolution settings */}
      {config.type === 'evolution' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <h4 className="text-sm font-semibold text-white">Configuração Evolution API</h4>
            <div>
              <label className="block text-xs text-gray-400 mb-1">URL do Evolution API</label>
              <input
                type="text"
                value={config.evolutionUrl || ''}
                onChange={e => setConfig(c => ({ ...c, evolutionUrl: e.target.value }))}
                placeholder="https://evolution.seudominio.com"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1.5">
                API Key
                {config.evolutionKeySaved && (
                  <span className="flex items-center gap-1 text-green-400 text-xs font-normal">
                    <KeyRound size={11} /> Chave salva — deixe vazio para manter
                  </span>
                )}
              </label>
              <input
                type="password"
                value={config.evolutionApiKey || ''}
                onChange={e => setConfig(c => ({ ...c, evolutionApiKey: e.target.value }))}
                placeholder={config.evolutionKeySaved ? 'Chave atual salva (cole nova para substituir)' : 'Chave de autenticação do Evolution'}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nome da Instância</label>
              <input
                type="text"
                value={config.evolutionInstance || ''}
                onChange={e => setConfig(c => ({ ...c, evolutionInstance: e.target.value }))}
                placeholder="SmartZap"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          {/* Status / QR Code */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white">Status da Conexão</h4>
              <button
                type="button"
                onClick={handleRefreshQR}
                disabled={refreshingQR}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw size={13} className={refreshingQR ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={16} className="animate-spin" />
                Verificando conexão...
              </div>
            ) : status?.connected ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-400">Conectado</p>
                  {status.phone && (
                    <p className="text-xs text-gray-400">
                      {status.name ? `${status.name} · ` : ''}{status.phone}
                    </p>
                  )}
                </div>
              </div>
            ) : status?.qrCode ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-yellow-400">
                  <QrCode size={16} />
                  Escaneie o QR code com o WhatsApp Business
                </div>
                <div className="flex justify-center p-4 bg-white rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={status.qrCode.startsWith('data:') ? status.qrCode : `data:image/png;base64,${status.qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-48 h-48"
                  />
                </div>
                <p className="text-xs text-center text-gray-500">
                  O QR code atualiza automaticamente a cada 5 segundos
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <WifiOff size={20} className="text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-400">Desconectado</p>
                  <p className="text-xs text-gray-400">
                    {status?.error || 'Salve as configurações para conectar'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GPT Maker Integration */}
      <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={15} className="text-amber-400" />
          <h4 className="text-sm font-semibold text-white">Integração GPT Maker</h4>
          <span className="text-xs text-gray-500 bg-zinc-800 px-2 py-0.5 rounded-full">opcional</span>
        </div>
        <p className="text-xs text-gray-500">
          Após cada disparo de campanha, registra a mensagem no agente para que ele reconheça a conversa quando o cliente responder.
        </p>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Agent ID</label>
          <input
            type="text"
            value={config.gptmakerAgentId || ''}
            onChange={e => setConfig(c => ({ ...c, gptmakerAgentId: e.target.value }))}
            placeholder="Ex: abc123def456"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1.5">
            JWT Token
            {config.gptmakerJwtTokenSaved && (
              <span className="flex items-center gap-1 text-green-400 text-xs font-normal">
                <KeyRound size={11} /> Token salvo — deixe vazio para manter
              </span>
            )}
          </label>
          <input
            type="password"
            value={config.gptmakerJwtToken || ''}
            onChange={e => setConfig(c => ({ ...c, gptmakerJwtToken: e.target.value }))}
            placeholder={config.gptmakerJwtTokenSaved ? `Token atual: ${config.gptmakerJwtTokenPreview} (cole novo para substituir)` : 'eyJhbGci...'}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!config.gptmakerDirectChannel}
            onChange={e => setConfig(c => ({ ...c, gptmakerDirectChannel: e.target.checked }))}
            className="w-4 h-4 rounded accent-amber-400"
          />
          <span className="text-xs text-gray-300">
            GPT Maker tem canal WhatsApp direto — SmartZap só registra contexto de campanhas, não responde às mensagens
          </span>
        </label>
      </div>

      {/* Chatwoot Integration */}
      <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare size={15} className="text-indigo-400" />
          <h4 className="text-sm font-semibold text-white">Integração Chatwoot</h4>
          <span className="text-xs text-gray-500 bg-zinc-800 px-2 py-0.5 rounded-full">opcional</span>
        </div>
        <p className="text-xs text-gray-500">
          Conecta o SmartZap como Agent Bot do Chatwoot. O GPT Maker responde às mensagens recebidas no Chatwoot.
        </p>
        <div>
          <label className="block text-xs text-gray-400 mb-1">URL do Chatwoot</label>
          <input
            type="text"
            value={config.chatwootUrl || ''}
            onChange={e => setConfig(c => ({ ...c, chatwootUrl: e.target.value }))}
            placeholder="https://chatwoot.seudominio.com"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Account ID</label>
          <input
            type="text"
            value={config.chatwootAccountId || ''}
            onChange={e => setConfig(c => ({ ...c, chatwootAccountId: e.target.value }))}
            placeholder="Ex: 1"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">Encontre em: Chatwoot → Settings → General Settings → Account ID</p>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1.5">
            API Token (User Access Token)
            {config.chatwootApiTokenSaved && (
              <span className="flex items-center gap-1 text-green-400 text-xs font-normal">
                <KeyRound size={11} /> Token salvo — deixe vazio para manter
              </span>
            )}
          </label>
          <input
            type="password"
            value={config.chatwootApiToken || ''}
            onChange={e => setConfig(c => ({ ...c, chatwootApiToken: e.target.value }))}
            placeholder={config.chatwootApiTokenSaved ? `Token atual: ${config.chatwootApiTokenPreview} (cole novo para substituir)` : 'Token de acesso do usuário administrador'}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">Encontre em: Chatwoot → Profile Settings → Access Token</p>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Inbox ID (opcional — filtra por caixa)</label>
          <input
            type="text"
            value={config.chatwootInboxId || ''}
            onChange={e => setConfig(c => ({ ...c, chatwootInboxId: e.target.value }))}
            placeholder="Ex: 2 (deixe vazio para responder em todas as caixas)"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Webhook URL to configure in Chatwoot */}
        {user?.organizationId && (
          <div className="pt-2 border-t border-white/10">
            <label className="block text-xs text-gray-400 mb-1">URL do Agent Bot (configure no Chatwoot)</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-indigo-300 break-all">
                {typeof window !== 'undefined' ? window.location.origin : ''}/api/chatwoot-bot?orgId={user.organizationId}
              </code>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/api/chatwoot-bot?orgId=${user.organizationId}`
                  navigator.clipboard.writeText(url)
                  toast.success('URL copiada!')
                }}
                className="shrink-0 p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                title="Copiar URL"
              >
                <Copy size={14} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Chatwoot → Settings → Integrations → Agent Bots → Add new Agent Bot → Cole esta URL como Bot URL
            </p>
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Salvando...' : 'Salvar Configuração'}
      </button>

    </div>
  )
}
