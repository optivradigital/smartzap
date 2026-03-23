'use client'

import React, { useState, useEffect } from 'react'

export function BrandingSettings() {
  const [form, setForm] = useState({
    brand_name: 'SmartZap',
    brand_logo_url: '',
    brand_primary_color: '#16a34a',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/settings/branding')
      .then(r => r.json())
      .then(d => setForm(d))
      .catch(() => {})
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/settings/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setMsg(res.ok ? 'Salvo! Recarregue a pagina para ver as mudancas.' : 'Erro ao salvar.')
    setSaving(false)
  }

  const isError = msg.startsWith('Erro')

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {msg && (
        <div className={`p-3 rounded-lg text-sm border ${isError ? 'bg-red-900/20 text-red-300 border-red-500/30' : 'bg-green-900/20 text-green-300 border-green-500/30'}`}>
          {msg}
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-400 mb-2">Nome da aplicacao</label>
        <input
          type="text"
          value={form.brand_name}
          onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))}
          className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
          placeholder="SmartZap"
        />
        <p className="text-xs text-gray-500 mt-1">Aparece no topo da sidebar e na aba do navegador</p>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">URL do Logo</label>
        <input
          type="url"
          value={form.brand_logo_url}
          onChange={e => setForm(f => ({ ...f, brand_logo_url: e.target.value }))}
          className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
          placeholder="https://seudominio.com/logo.png"
        />
        <p className="text-xs text-gray-500 mt-1">PNG ou SVG com fundo transparente. Deixe vazio para usar o icone padrao.</p>
        {form.brand_logo_url && (
          <div className="mt-2 p-3 bg-zinc-800 rounded-lg inline-block">
            <img src={form.brand_logo_url} alt="Preview" className="h-10 object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Cor principal</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.brand_primary_color}
            onChange={e => setForm(f => ({ ...f, brand_primary_color: e.target.value }))}
            className="w-12 h-10 rounded-lg border border-zinc-700 bg-zinc-800 cursor-pointer"
          />
          <input
            type="text"
            value={form.brand_primary_color}
            onChange={e => setForm(f => ({ ...f, brand_primary_color: e.target.value }))}
            className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm font-mono"
            placeholder="#16a34a"
          />
          <div className="w-10 h-10 rounded-lg border border-zinc-700" style={{ backgroundColor: form.brand_primary_color }} />
        </div>
        <p className="text-xs text-gray-500 mt-1">Cor dos botoes e destaques. Padrao: verde (#16a34a)</p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-6 py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {saving ? 'Salvando...' : 'Salvar Branding'}
      </button>
    </form>
  )
}
