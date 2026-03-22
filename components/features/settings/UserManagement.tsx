'use client'

import React, { useState, useEffect } from 'react'
import { Users, Plus, Trash2, Shield, User, Eye, EyeOff, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

interface UserRecord {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  createdAt: string
}

export function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user')
  const [showPw, setShowPw] = useState(false)
  const [creating, setCreating] = useState(false)

  const fetchUsers = async () => {
    const res = await fetch('/api/auth/users')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newPassword) { toast.error('Preencha e-mail e senha'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, name: newName, role: newRole })
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erro ao criar usuário'); return }
      toast.success('Usuário criado!')
      setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('user'); setShowForm(false)
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nome</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Função</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'user')}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                <option value="user">Usuário</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">E-mail *</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="usuario@empresa.com" required
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
          </div>
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
        <p className="text-xs text-gray-500 italic">Nenhum usuário cadastrado. Clique em &quot;Novo usuário&quot; para criar o primeiro.</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
              <div className="flex items-center gap-3">
                <div className={'p-2 rounded-lg ' + (u.role === 'admin' ? 'bg-purple-500/20' : 'bg-white/5')}>
                  {u.role === 'admin' ? <Shield size={14} className="text-purple-400" /> : <User size={14} className="text-gray-400" />}
                </div>
                <div>
                  <p className="text-sm text-white font-medium">{u.name || u.email}</p>
                  <p className="text-xs text-gray-500">{u.email} · {u.role === 'admin' ? 'Admin' : 'Usuário'}</p>
                </div>
              </div>
              <button type="button" onClick={() => handleDelete(u)}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-600">Cada usuário acessa o SmartZap com seu próprio e-mail e senha.</p>
    </div>
  )
}
