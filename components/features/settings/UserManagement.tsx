'use client'

import React, { useState, useEffect } from 'react'
import { Users, Plus, Trash2, Shield, User, Eye, EyeOff, Loader2, Check, Crown, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type AppRole = 'super_admin' | 'manager' | 'user'

interface UserRecord {
  id: string
  email: string
  name: string
  role: AppRole
  organization_id?: string
  created_at?: string
}

interface OrgOption {
  id: string
  name: string
  slug: string
}

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Admin',
  manager: 'Manager',
  user: 'Usuário',
}

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: 'text-purple-400 bg-purple-500/20',
  manager: 'text-blue-400 bg-blue-500/20',
  user: 'text-gray-400 bg-white/5',
}

const ROLE_ICONS: Record<AppRole, React.ReactNode> = {
  super_admin: <Crown size={14} className="text-purple-400" />,
  manager: <Shield size={14} className="text-blue-400" />,
  user: <User size={14} className="text-gray-400" />,
}

export function UserManagement() {
  const { user: currentUser, isSuperAdmin, isManager } = useCurrentUser()

  const [users, setUsers] = useState<UserRecord[]>([])
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<AppRole>('user')
  const [newOrgId, setNewOrgId] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [creating, setCreating] = useState(false)

  const fetchUsers = async () => {
    const res = await fetch('/api/auth/users')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  const fetchOrgs = async () => {
    const res = await fetch('/api/organizations')
    if (res.ok) {
      const data: OrgOption[] = await res.json()
      setOrgs(data)
      // Pre-select manager's own org
      if (data.length > 0 && !isSuperAdmin) {
        setNewOrgId(data[0].id)
      }
    }
  }

  useEffect(() => {
    Promise.all([fetchUsers(), fetchOrgs()])
  }, [isSuperAdmin])

  // Org name lookup
  const orgName = (orgId?: string) => {
    if (!orgId) return null
    return orgs.find(o => o.id === orgId)?.name || orgId
  }

  // Allowed roles to create based on current user
  const allowedRoles: { value: AppRole; label: string }[] = isSuperAdmin
    ? [
        { value: 'super_admin', label: 'Admin (Super)' },
        { value: 'manager', label: 'Manager' },
        { value: 'user', label: 'Usuário' },
      ]
    : isManager
    ? [
        { value: 'manager', label: 'Manager' },
        { value: 'user', label: 'Usuário' },
      ]
    : []

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newPassword) { toast.error('Preencha e-mail e senha'); return }
    if (isSuperAdmin && !newOrgId) { toast.error('Selecione a organização'); return }

    setCreating(true)
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          name: newName,
          role: newRole,
          organizationId: newOrgId || currentUser?.organizationId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro ao criar usuário'); return }
      toast.success('Usuário criado!')
      setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('user')
      if (isSuperAdmin) setNewOrgId('')
      setShowForm(false)
      fetchUsers()
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (u: UserRecord) => {
    if (!confirm('Remover usuário ' + u.email + '?')) return
    const res = await fetch('/api/auth/users?id=' + u.id, { method: 'DELETE' })
    if (res.ok) { toast.success('Usuário removido'); fetchUsers() }
    else { const d = await res.json(); toast.error(d.error || 'Erro') }
  }

  // Users can't manage anyone
  if (!isManager) return null

  return (
    <div className="space-y-5 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-purple-400" />
          <span className="text-sm font-semibold text-white">Usuários</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">{users.length}</span>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors">
          <Plus size={13} /> Novo usuário
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 p-4 rounded-xl bg-black/30 border border-white/10">
          {/* Row 1: Nome + Função */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nome</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Função</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as AppRole)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                {allowedRoles.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Organização — super_admin escolhe, manager vê a própria */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
              <Building2 size={11} /> Organização
            </label>
            {isSuperAdmin ? (
              <select value={newOrgId} onChange={e => setNewOrgId(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                <option value="">Selecione a organização...</option>
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            ) : (
              <div className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-sm text-gray-400">
                {orgName(currentUser?.organizationId) || 'Sua organização'}
              </div>
            )}
          </div>

          {/* E-mail */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">E-mail *</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="usuario@empresa.com" required
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
          </div>

          {/* Senha */}
          <div className="relative">
            <label className="text-xs text-gray-400 mb-1 block">Senha (mín. 6 caracteres)</label>
            <input type={showPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres" required minLength={6}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 pr-10 text-sm text-white focus:outline-none focus:border-purple-500" />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 bottom-2 text-gray-500 hover:text-gray-300">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">Cancelar</button>
            <button type="submit" disabled={creating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Criar usuário
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={14} className="animate-spin" /> Carregando...
        </div>
      ) : users.length === 0 ? (
        <p className="text-xs text-gray-500 italic">Nenhum usuário cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const role = (u.role || 'user') as AppRole
            const uOrgName = orgName(u.organization_id)
            return (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className={'p-2 rounded-lg ' + ROLE_COLORS[role]}>
                    {ROLE_ICONS[role]}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{u.name || u.email}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">{u.email}</span>
                      <span className={'text-xs px-1.5 py-0.5 rounded-md font-medium ' + ROLE_COLORS[role]}>
                        {ROLE_LABELS[role]}
                      </span>
                      {uOrgName && isSuperAdmin && (
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                          <Building2 size={10} /> {uOrgName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => handleDelete(u)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-xs text-gray-600">Cada usuário acessa o SmartZap com seu próprio e-mail e senha.</p>
    </div>
  )
}
