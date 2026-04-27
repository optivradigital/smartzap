'use client'

/**
 * Bootstrap Page - First step of setup
 * 
 * Collects Vercel token to enable environment variable management
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Key, ArrowRight, ExternalLink, Check, AlertCircle, Loader2, Globe } from 'lucide-react'

interface ProjectInfo {
  id: string
  name: string
  teamId?: string
  url?: string
}

export default function BootstrapPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'input' | 'validating' | 'confirm' | 'success'>('input')
  const [project, setProject] = useState<ProjectInfo | null>(null)

  // Check for existing session
  useEffect(() => {
    const savedToken = localStorage.getItem('setup_token')
    const savedProject = localStorage.getItem('setup_project')

    if (savedToken && savedProject) {
      try {
        const parsedProject = JSON.parse(savedProject)
        setToken(savedToken)
        setProject(parsedProject)
        setStep('confirm') // Go straight to confirmation
      } catch (e) {
        localStorage.removeItem('setup_project')
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token.trim()) {
      setError('Token é obrigatório')
      return
    }

    setIsLoading(true)
    setStep('validating')

    try {
      const response = await fetch('/api/setup/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          domain: window.location.hostname,
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao validar token')
      }

      // Store token and show project confirmation
      setProject(data.project)
      setStep('confirm')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao validar token')
      setStep('input')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = () => {
    if (!project) return

    // Store token and project info in localStorage for wizard persistence
    localStorage.setItem('setup_token', token.trim())
    localStorage.setItem('setup_project', JSON.stringify(project))

    setStep('success')

    // Redirect to wizard after brief delay
    setTimeout(() => {
      router.push('/setup/wizard')
    }, 1000)
  }

  const handleBack = () => {
    setStep('input')
    setProject(null)
    setError('')
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-blue-600 mb-4">
            <span className="text-3xl font-bold text-white">S</span>
          </div>
          <h1 className="text-2xl font-bold text-white">SmartZap</h1>
          <p className="text-zinc-400 mt-1">Configuração inicial</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <div className="w-8 h-0.5 bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-8 h-0.5 bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-8 h-0.5 bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          {step === 'success' ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
                <Check className="w-8 h-8 text-blue-500" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Projeto confirmado!
              </h2>
              <p className="text-zinc-400 text-sm">
                Redirecionando para o wizard...
              </p>
            </div>
          ) : step === 'confirm' && project ? (
            <div>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
                  <Globe className="w-8 h-8 text-blue-500" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">
                  Projeto encontrado!
                </h2>
                <p className="text-zinc-400 text-sm">
                  Confirme se este é o projeto correto
                </p>
              </div>

              {/* Project Info */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 mb-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 text-sm">Nome:</span>
                    <span className="text-white font-medium">{project.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 text-sm">URL:</span>
                    <a
                      href={`https://${project.url || `${project.name}.vercel.app`}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline text-sm flex items-center gap-1"
                    >
                      {project.url || `${project.name}.vercel.app`}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 text-sm">Domínio atual:</span>
                    <span className="text-white text-sm font-mono">{typeof window !== 'undefined' ? window.location.hostname : ''}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  Confirmar
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 className="text-lg font-semibold text-white mb-1">
                Token da Vercel
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Precisamos do seu token para configurar as variáveis de ambiente
              </p>

              {/* Instructions */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">Como obter o token:</h3>
                <ol className="space-y-2 text-sm text-zinc-400">
                  <li className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-300 text-xs flex items-center justify-center">1</span>
                    <span>Acesse <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1">
                      vercel.com/account/tokens <ExternalLink className="w-3 h-3" />
                    </a></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-300 text-xs flex items-center justify-center">2</span>
                    <span>Clique em <strong className="text-zinc-300">&quot;Create&quot;</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-300 text-xs flex items-center justify-center">3</span>
                    <span>Nome: <code className="bg-zinc-700 px-1.5 py-0.5 rounded text-blue-400">SmartZap Setup</code></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-300 text-xs flex items-center justify-center">4</span>
                    <span>Scope: <strong className="text-zinc-300">Full Account</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-300 text-xs flex items-center justify-center">5</span>
                    <span>Copie o token gerado</span>
                  </li>
                </ol>
              </div>

              {/* Token input */}
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Cole seu token aqui"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !token.trim()}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Security note */}
        <p className="text-center text-zinc-600 text-xs mt-6">
          🔒 Seu token será salvo de forma segura nas variáveis de ambiente
        </p>
      </div>
    </div>
  )
}
