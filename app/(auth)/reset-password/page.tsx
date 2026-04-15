'use client'

/**
 * Reset Password Page
 * Reads ?token= from URL and allows the user to set a new password
 */

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Token de recuperação inválido ou ausente.')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Token de recuperação inválido ou ausente.')
      return
    }
    if (!password) {
      setError('Digite sua nova senha')
      return
    }
    if (password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao redefinir senha')

      setSuccess(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao redefinir senha')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-500 to-emerald-600 mb-4">
          <span className="text-3xl font-bold text-white">S</span>
        </div>
        <h1 className="text-2xl font-bold text-white">SmartZap</h1>
        <p className="text-zinc-400 mt-1">Redefinir senha</p>
      </div>

      {/* Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        {success ? (
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">Senha redefinida!</h2>
            <p className="text-zinc-400 text-sm">
              Sua senha foi atualizada. Redirecionando para o login…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-zinc-400 text-sm mb-2">
              Escolha uma nova senha para sua conta.
            </p>

            {/* New Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nova senha"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-11 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                autoFocus
                autoComplete="new-password"
                disabled={!token}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Confirm Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar nova senha"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-11 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                autoComplete="new-password"
                disabled={!token}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || !token}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Redefinir senha'
              )}
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-zinc-600 text-sm mt-6">
        SmartZap © {new Date().getFullYear()}
      </p>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Suspense fallback={<div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
