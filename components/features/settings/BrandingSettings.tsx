'use client'
import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, X, Image } from 'lucide-react'

export function BrandingSettings() {
  const [brandName, setBrandName] = useState('SmartZap')
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#16a34a')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/settings/branding')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setBrandName(d.brand_name || 'SmartZap')
          setLogoUrl(d.brand_logo_url || '')
          setPrimaryColor(d.brand_primary_color || '#16a34a')
        }
      })
      .catch(() => {})
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setIsUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/settings/branding/logo', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao fazer upload')
      setLogoUrl(data.url)
      setPreview(null)
      toast.success('Logo carregado!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer upload'
      setError(msg)
      setPreview(null)
      toast.error(msg)
    } finally {
      setIsUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleRemoveLogo = async () => {
    setLogoUrl('')
    setPreview(null)
    await fetch('/api/settings/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_logo_url: '' }),
    })
    toast.success('Logo removido')
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: brandName,
          brand_logo_url: logoUrl,
          brand_primary_color: primaryColor,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      toast.success('Branding salvo!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const currentLogo = preview || logoUrl

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">Nome da aplicacao</label>
        <input
          type="text"
          value={brandName}
          onChange={e => setBrandName(e.target.value)}
          placeholder="SmartZap"
          className="w-full bg-background border border-border text-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-border/60"
        />
        <p className="text-xs text-muted-foreground mt-1">Aparece no topo da sidebar e na aba do navegador</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">Logo</label>
        {currentLogo ? (
          <div className="flex items-center gap-4 p-4 bg-muted/20 rounded-xl border border-border">
            <img src={currentLogo} alt="Logo" className="h-12 object-contain max-w-[120px]" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{logoUrl || 'Pre-visualizacao'}</p>
              {isUploading && <p className="text-xs text-blue-400 mt-1">Enviando...</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
                className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                title="Trocar logo"
              >
                <Upload size={16} />
              </button>
              <button
                onClick={handleRemoveLogo}
                disabled={isUploading}
                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                title="Remover logo"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className="w-full flex flex-col items-center gap-3 p-8 bg-muted/20 border border-dashed border-border rounded-xl hover:border-border/60 hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
          >
            {isUploading ? (
              <>
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Enviando...</span>
              </>
            ) : (
              <>
                <Image size={28} />
                <span className="text-sm">Clique para carregar logo</span>
                <span className="text-xs text-muted-foreground/60">PNG, JPG, SVG ou WebP - max 2MB</span>
              </>
            )}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">Cor principal</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={e => setPrimaryColor(e.target.value)}
            className="w-12 h-12 rounded-xl border border-border bg-transparent cursor-pointer"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={e => setPrimaryColor(e.target.value)}
            placeholder="#16a34a"
            className="flex-1 bg-background border border-border text-foreground rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-border/60"
          />
          <div
            className="w-12 h-12 rounded-xl border border-border flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">Cor dos botoes e destaques. Padrao: verde (#16a34a)</p>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="px-6 py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-70"
        style={{ backgroundColor: primaryColor }}
      >
        {isSaving ? 'Salvando...' : 'Salvar Branding'}
      </button>
    </div>
  )
}
