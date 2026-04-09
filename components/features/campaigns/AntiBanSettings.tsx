'use client'

/**
 * Anti-ban settings para campanhas via Evolution API
 * Aparece automaticamente quando o provider é Evolution
 */

import React, { useState } from 'react'
import { Plus, Trash2, Shuffle, Clock, Shield, MessageSquare } from 'lucide-react'

export interface AntiBanConfig {
  delayMinSec: number
  delayMaxSec: number
  simulateTyping: boolean
  messageVariants: string[]
  dailyLimit: number | undefined
}

interface Props {
  value: AntiBanConfig
  onChange: (config: AntiBanConfig) => void
  providerType: 'meta' | 'evolution'
}

export const DEFAULT_ANTI_BAN: AntiBanConfig = {
  delayMinSec: 3,
  delayMaxSec: 12,
  simulateTyping: true,
  messageVariants: [],
  dailyLimit: undefined,
}

export function AntiBanSettings({ value, onChange, providerType }: Props) {
  const [newVariant, setNewVariant] = useState('')

  if (providerType === 'meta') {
    return (
      <div className="p-4 rounded-xl border border-white/10 bg-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Anti-Ban</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">Meta API</span>
        </div>
        <p className="text-xs text-gray-400">
          Meta Cloud API é a API oficial do WhatsApp — sem risco de banimento. Configurações anti-ban não são necessárias.
        </p>
      </div>
    )
  }

  const addVariant = () => {
    if (!newVariant.trim()) return
    onChange({ ...value, messageVariants: [...value.messageVariants, newVariant.trim()] })
    setNewVariant('')
  }

  const removeVariant = (i: number) => {
    const updated = value.messageVariants.filter((_, idx) => idx !== i)
    onChange({ ...value, messageVariants: updated })
  }

  return (
    <div className="space-y-5 p-4 rounded-xl border border-green-500/20 bg-green-500/5">
      <div className="flex items-center gap-2">
        <Shield size={16} className="text-green-400" />
        <span className="text-sm font-semibold text-white">Configurações Anti-Ban</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">Evolution API</span>
      </div>

      {/* Delay */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Clock size={14} className="text-gray-400" />
          <label className="text-xs font-semibold text-gray-300">Delay entre mensagens</label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Mínimo (segundos)</label>
            <input
              type="number"
              min={1}
              max={3600}
              value={value.delayMinSec}
              onChange={e => onChange({ ...value, delayMinSec: Math.max(1, Math.min(3600, +e.target.value || 1)) })}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Máximo (segundos)</label>
            <input
              type="number"
              min={1}
              max={3600}
              value={value.delayMaxSec}
              onChange={e => onChange({ ...value, delayMaxSec: Math.max(1, Math.min(3600, +e.target.value || 1)) })}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          O sistema aguarda entre {value.delayMinSec}s e {value.delayMaxSec}s de forma aleatória entre cada envio.
        </p>
      </div>

      {/* Typing simulation */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <MessageSquare size={14} className="text-gray-400" />
            <label className="text-xs font-semibold text-gray-300">Simular "digitando..."</label>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Mostra o indicador de digitação antes de enviar (mais natural, reduz risco de ban)
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...value, simulateTyping: !value.simulateTyping })}
          className={`relative w-11 h-6 rounded-full transition-colors ${value.simulateTyping ? 'bg-green-500' : 'bg-white/10'}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value.simulateTyping ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>

      {/* Daily limit */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Shield size={14} className="text-gray-400" />
          <label className="text-xs font-semibold text-gray-300">Limite diário</label>
          <span className="text-xs text-gray-500">(opcional)</span>
        </div>
        <input
          type="number"
          min={0}
          max={1000}
          placeholder="Sem limite (recomendado: 200 para números novos)"
          value={value.dailyLimit ?? ''}
          onChange={e => onChange({ ...value, dailyLimit: e.target.value ? +e.target.value : undefined })}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
        />
      </div>

      {/* Message variants (spinning) */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Shuffle size={14} className="text-gray-400" />
          <label className="text-xs font-semibold text-gray-300">Variações da mensagem</label>
          <span className="text-xs text-gray-500">(spinning)</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Adicione variações do mesmo texto. O sistema escolhe uma aleatoriamente para cada contato.
          Use <code className="text-green-400">{'{nome}'}</code> para inserir o nome do contato.
        </p>

        <div className="space-y-2 mb-3">
          {value.messageVariants.map((v, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 p-3 rounded-lg bg-black/30 border border-white/10 text-sm text-gray-300 whitespace-pre-wrap break-words">
                {v}
              </div>
              <button
                type="button"
                onClick={() => removeVariant(i)}
                className="mt-1 p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {value.messageVariants.length === 0 && (
            <p className="text-xs text-gray-600 italic">Nenhuma variação. O campo "Mensagem" da campanha será usado como texto fixo.</p>
          )}
        </div>

        <div className="flex gap-2">
          <textarea
            rows={3}
            value={newVariant}
            onChange={e => setNewVariant(e.target.value)}
            placeholder={`Ex: Oi {nome}, tudo bem? Temos uma oferta especial para você! 🎁`}
            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500 resize-none"
          />
          <button
            type="button"
            onClick={addVariant}
            disabled={!newVariant.trim()}
            className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

    </div>
  )
}
