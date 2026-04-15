'use client'

/**
 * Forgot Password Page
 * Sends a password reset link to the user's email
 */

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, Send } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Digite seu e-mail')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao enviar e-mail')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar e-mail')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-500 to-emerald-600 mb-4">
            <span className="text-3xl font-bold text-white">S</span>
          </div>
          <h1 className="text-2xl font-bold text-white">SmartZap</h1>
          <p className="text-zinc-400 mt-1">Recuperação de senha</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          {submitted ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-4">
                <Send className="w-6 h-6 text-emerald-500" />
              </div>
              <h2 className="text-white font-semibold text-lg mb-2">E-mail enviado</h2>
              <p className="text-zinc-400 text-sm mb-6">
                Se existir uma conta com esse e-mail, você receberá um link para redefinir sua senha em breve.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-zinc-400 text-sm mb-2">
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>

              {/* Email */}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
                  autoComplete="email"
                />
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Send className="w-4 h-4" /> Enviar link de recuperação</>
                )}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-zinc-600 text-sm mt-6">
          SmartZap © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
