'use client'

import React, { useEffect, useState } from 'react'
import { Building2, Plus, Trash2, Loader2, CheckCircle2, AlertCircle, X, UserPlus, ChevronDown } from 'lucide-react'

interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  created_at: string
}

export function OrganizationManagement() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showUserFields, setShowUserFields] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    name: '',
    slug: '',
    adminEmail: '',
    adminPassword: '',
    adminName: '',
  })

  useEffect(() => { fetchOrgs() }, [])

  async function fetchOrgs() {
    setLoading(true)
    const res = await fetch('/api/organizations')
    if (res.ok) setOrgs(await res.json())
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    setSuccess('')

    // If user toggle is ON, validate password
    if (showUserFields && form.adminEmail && form.adminPassword.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres')
      setCreating(false)
      return
    }

    const payload = {
      name: form.name,
      slug: form.slug,
      // Only send user fields if toggle is on and email is filled
      adminEmail: showUserFields ? form.adminEmail : '',
      adminPassword: showUserFields ? form.adminPassword : '',
      adminName: showUserFields ? form.adminName : '',
    }

    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    if (res.ok) {
      const userMsg = data.user ? ` Manager ${data.user.email} criado.` : ''
      setSuccess(`Organização "${data.org.name}" criada com sucesso!${userMsg}`)
      setShowForm(false)
      setShowUserFields(false)
      setForm({ name: '', slug: '', adminEmail: '', adminPassword: '', adminName: '' })
      fetchOrgs()
    } else {
      setError(data.error || 'Erro ao criar organização')
    }
    setCreating(false)
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/organizations?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setSuccess('Organização removida.')
      setDeleteConfirm(null)
      fetchOrgs()
    } else {
      const data = await res.json()
      setError(data.error || 'Erro ao remover organização')
      setDeleteConfirm(null)
    }
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 30)
  }

  return (
    <div className="space-y-4">

      {/* Feedback messages */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          {success}
        </div>
      )}

      {/* Organization list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={14} className="animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="space-y-2">
          {orgs.map(org => (
            <div key={org.id}
              className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Building2 size={16} className="text-orange-400" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{org.name}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {org.slug} · {org.plan} · {new Date(org.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              {deleteConfirm === org.id ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDelete(org.id)}
                    className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">
                    Confirmar
                  </button>
                  <button onClick={() => setDeleteConfirm(null)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(org.id)}
                  className="px-3 py-1.5 text-xs text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors">
                  Remover
                </button>
              )}
            </div>
          ))}
          {orgs.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">Nenhuma organização cadastrada</p>
          )}
        </div>
      )}

      {/* Create button */}
      <button
        onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
        className="w-full py-3 px-4 border-2 border-dashed border-white/10 rounded-xl text-sm text-gray-400 hover:border-orange-500/40 hover:text-orange-400 transition-colors flex items-center justify-center gap-2">
        {showForm
          ? <><X size={14} /> Cancelar</>
          : <><Plus size={14} /> Nova Organização</>}
      </button>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate}
          className="space-y-4 p-5 rounded-xl border border-white/10 bg-zinc-900">

          <h4 className="font-semibold text-white text-sm flex items-center gap-2">
            <Building2 size={15} className="text-orange-400" />
            Nova Organização
          </h4>

          {/* Nome + Slug */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Nome da empresa *</label>
              <input
                type="text" required
                value={form.name}
                onChange={e => {
                  const name = e.target.value
                  setForm(f => ({ ...f, name, slug: autoSlug(name) }))
                }}
                className="w-full px-3 py-2 text-sm bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                placeholder="Glowforever"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Slug (URL) *</label>
              <input
                type="text" required
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-600 font-mono focus:outline-none focus:border-orange-500"
                placeholder="glowforever"
              />
            </div>
          </div>

          {/* Toggle: criar usuário */}
          <div className="pt-1 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowUserFields(v => !v)}
              className="flex items-center justify-between w-full text-left group"
            >
              <div className="flex items-center gap-2">
                <UserPlus size={14} className={showUserFields ? 'text-blue-400' : 'text-gray-500'} />
                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                  Criar usuário para esta organização
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-gray-500">opcional</span>
              </div>
              <ChevronDown
                size={14}
                className={`text-gray-500 transition-transform ${showUserFields ? 'rotate-180' : ''}`}
              />
            </button>

            {showUserFields && (
              <div className="mt-3 space-y-3 pt-3 border-t border-white/5">
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold">Manager</span>
                  responsável por esta organização
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Nome</label>
                    <input
                      type="text"
                      value={form.adminName}
                      onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                      placeholder="João Silva"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">E-mail *</label>
                    <input
                      type="email"
                      required={showUserFields}
                      value={form.adminEmail}
                      onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                      placeholder="manager@empresa.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Senha *</label>
                  <input
                    type="password"
                    required={showUserFields}
                    minLength={6}
                    value={form.adminPassword}
                    onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit" disabled={creating}
            className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
            {creating
              ? <><Loader2 size={14} className="animate-spin" /> Criando...</>
              : <><Plus size={14} /> Criar Organização</>}
          </button>
        </form>
      )}
    </div>
  )
}
