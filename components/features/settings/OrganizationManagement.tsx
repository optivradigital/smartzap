'use client'

import React, { useEffect, useState } from 'react'

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

    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    if (res.ok) {
      setSuccess(`Organização "${data.org.name}" criada com sucesso!`)
      setShowForm(false)
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
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>
      )}

      {/* Organization list */}
      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {orgs.map(org => (
            <div key={org.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="font-medium text-gray-800">{org.name}</p>
                <p className="text-xs text-gray-500">
                  slug: <span className="font-mono">{org.slug}</span> · plano: {org.plan} · criada em {new Date(org.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              {deleteConfirm === org.id ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(org.id)}
                    className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-3 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(org.id)}
                  className="px-3 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          {orgs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Nenhuma organização cadastrada</p>
          )}
        </div>
      )}

      {/* Create button */}
      <button
        onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
        className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
      >
        {showForm ? '✕ Cancelar' : '+ Nova Organização'}
      </button>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="font-medium text-gray-700 text-sm">Nova Organização</h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nome da empresa *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => {
                  const name = e.target.value
                  setForm(f => ({ ...f, name, slug: autoSlug(name) }))
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                placeholder="Glowforever"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Slug (URL) *</label>
              <input
                type="text"
                required
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono"
                placeholder="glowforever"
              />
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs text-gray-400 mb-2">Usuário admin desta organização</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nome</label>
                <input
                  type="text"
                  value={form.adminName}
                  onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  placeholder="João Silva"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">E-mail *</label>
                <input
                  type="email"
                  required
                  value={form.adminEmail}
                  onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                  placeholder="admin@empresa.com"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">Senha *</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.adminPassword}
                onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-2 px-4 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {creating ? 'Criando...' : 'Criar Organização'}
          </button>
        </form>
      )}
    </div>
  )
}
