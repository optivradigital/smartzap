'use client'

/**
 * Setup Wizard Page
 * 
 * Multi-step configuration wizard:
 * 1. Password (MASTER_PASSWORD)
 * 2. Turso (database)
 * 3. Upstash (Redis + QStash)
 * 4. WhatsApp (API credentials)
 * 5. Company info
 */

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Lock, Database, Cloud, MessageSquare, Building2,
  ArrowRight, ArrowLeft, Check, AlertCircle, Loader2,
  Eye, EyeOff, ExternalLink, Mail, Phone,
  Copy, X, FileJson, Terminal
} from 'lucide-react'

interface WizardData {
  // Step 1: Password
  password: string
  confirmPassword: string

  // Step 2: Supabase
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceKey: string
  databaseUrl?: string // Optional for auto-migration

  // Step 3: Upstash
  redisUrl: string
  redisToken: string
  qstashToken: string
  // Optional stats fields
  upstashEmail: string
  upstashApiKey: string
  upstashConsoleUrl: string

  // Step 4: WhatsApp
  whatsappToken: string
  whatsappPhoneId: string
  whatsappBusinessId: string

  // Step 5: Company
  companyName: string
  email: string
  phone: string
}

const initialData: WizardData = {
  password: '',
  confirmPassword: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseServiceKey: '',
  redisUrl: '',
  redisToken: '',
  qstashToken: '',
  upstashEmail: '',
  upstashApiKey: '',
  upstashConsoleUrl: '',
  whatsappToken: '',
  whatsappPhoneId: '',
  whatsappBusinessId: '',
  companyName: '',
  email: '',
  phone: '',
}

const STEPS = [
  { id: 1, title: 'Senha', icon: Lock },
  { id: 2, title: 'Database', icon: Database },
  { id: 3, title: 'Redis', icon: Cloud },
  { id: 4, title: 'WhatsApp', icon: MessageSquare },
  { id: 5, title: 'Empresa', icon: Building2 },
]

function WizardContent() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>(initialData)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [vercelToken, setVercelToken] = useState('')
  const [projectInfo, setProjectInfo] = useState<{ id: string; name: string; teamId?: string } | null>(null)
  const [setupComplete, setSetupComplete] = useState(false)

  // Validation state
  const [isValidating, setIsValidating] = useState(false)

  // Database check state
  const [dbStatus, setDbStatus] = useState<'exists' | 'clean' | null>(null)
  const [resetConfirm, setResetConfirm] = useState(false)

  // SQL Schema state
  const [showSql, setShowSql] = useState(false)
  const [sqlContent, setSqlContent] = useState('')
  const [loadingSql, setLoadingSql] = useState(false)
  const [copied, setCopied] = useState(false)

  // Migration state
  const [migrating, setMigrating] = useState(false)
  const [migrationSuccess, setMigrationSuccess] = useState(false)

  // Check for bootstrap data
  const searchParams = useSearchParams()

  useEffect(() => {
    const isResume = searchParams.get('resume') === 'true'

    const token = localStorage.getItem('setup_token')
    const project = localStorage.getItem('setup_project')

    if (!token && !isResume) {
      router.push('/setup/start')
      return
    }

    // CRITICAL: Populate vercelToken state from localStorage
    if (token) {
      setVercelToken(token)
    }

    // Attempt to parse project info if available
    if (project) {
      try {
        setProjectInfo(JSON.parse(project))
      } catch (e) {
        console.error('Invalid project info', e)
      }
    } else if (isResume) {
      // Mock project info for UI so it stops loading
      setProjectInfo({ id: 'resumed', name: 'Configuração Manual' })
    } else {
      router.push('/setup/start')
      return
    }

    // Check which env vars are already configured and skip to appropriate step
    if (isResume) {
      fetch('/api/setup/env-status')
        .then(res => res.json())
        .then(data => {
          if (data.nextStep && data.nextStep > 1) {
            setStep(data.nextStep)
          }
        })
        .catch(err => console.error('Failed to fetch env status:', err))
    }
  }, [router, searchParams])

  // Fetch existing env vars from Vercel
  useEffect(() => {
    if (!vercelToken || !projectInfo?.id) return

    const fetchEnvVars = async () => {
      try {
        const res = await fetch('/api/setup/get-env', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: vercelToken,
            projectId: projectInfo.id,
            teamId: projectInfo.teamId
          })
        })

        if (!res.ok) return

        const { envs } = await res.json()
        if (!envs || !Array.isArray(envs)) return

        // Map Vercel envs to WizardData
        const mapping: Record<string, keyof WizardData> = {
          NEXT_PUBLIC_SUPABASE_URL: 'supabaseUrl',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'supabaseAnonKey',
          SUPABASE_SERVICE_ROLE_KEY: 'supabaseServiceKey',
          UPSTASH_REDIS_REST_URL: 'redisUrl',
          UPSTASH_REDIS_REST_TOKEN: 'redisToken',
          QSTASH_TOKEN: 'qstashToken',
          WHATSAPP_TOKEN: 'whatsappToken',
          WHATSAPP_PHONE_ID: 'whatsappPhoneId',
          WHATSAPP_BUSINESS_ACCOUNT_ID: 'whatsappBusinessId',
          // Add others if needed
        }

        setData(prev => {
          const newData = { ...prev }
          let hasChanges = false

          envs.forEach((env: any) => {
            const key = mapping[env.key]
            // Only update if current value is empty and we have a value from Vercel
            if (key && !newData[key] && env.value) {
              // @ts-ignore
              newData[key] = env.value
              hasChanges = true
            }
          })

          return hasChanges ? newData : prev
        })

      } catch (err) {
        console.error('Failed to fetch existing envs:', err)
      }
    }

    // Only run if we don't have local data populated (or maybe always run to fill gaps?)
    // Let's run it. LocalStorage loading below will act as "latest edit".
    // Actually, we should run this, and then let LocalStorage overwrite if it has newer data?
    // The previous useEffect loads localStorage on mount. This one runs when vercelToken is set.
    // If we rely on standard React batching, we should be careful.
    // Ideal: Load everything, merge.
    fetchEnvVars()

  }, [vercelToken, projectInfo])

  // Load state from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('smartzap_setup_data')
    const savedStep = localStorage.getItem('smartzap_setup_step')

    if (savedData) {
      try {
        setData(prev => ({ ...prev, ...JSON.parse(savedData) }))
      } catch (e) {
        console.error('Error parsing saved setup data', e)
      }
    }

    if (savedStep) {
      setStep(parseInt(savedStep))
    }
  }, [])

  // Save state to localStorage on change
  useEffect(() => {
    localStorage.setItem('smartzap_setup_data', JSON.stringify(data))
  }, [data])

  useEffect(() => {
    localStorage.setItem('smartzap_setup_step', step.toString())
  }, [step])

  const updateField = (field: keyof typeof data, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  // Validation function for external services - returns true if valid
  const validateCredentials = async (): Promise<boolean> => {
    setIsValidating(true)
    setError('')

    try {
      let type: string
      let credentials: Record<string, string>

      switch (step) {
        case 2: // Supabase
          type = 'database'
          credentials = { url: data.supabaseUrl, key: data.supabaseAnonKey }
          break
        case 3: // Redis + QStash
          type = 'redis'
          credentials = { url: data.redisUrl, token: data.redisToken }
          break
        case 4: // WhatsApp
          type = 'whatsapp'
          credentials = {
            token: data.whatsappToken,
            phoneId: data.whatsappPhoneId,
            businessId: data.whatsappBusinessId
          }
          break
        default:
          return true
      }

      const response = await fetch('/api/setup/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, credentials })
      })

      const result = await response.json()

      if (!result.valid) {
        setError(result.error || 'Credenciais inválidas')
        return false
      }

      // If Redis is valid, also validate QStash
      if (step === 3 && data.qstashToken) {
        const qstashResponse = await fetch('/api/setup/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'qstash', credentials: { token: data.qstashToken } })
        })
        const qstashResult = await qstashResponse.json()
        if (!qstashResult.valid) {
          setError(`Redis OK, mas QStash falhou: ${qstashResult.error}`)
          return false
        }
      }

      return true
    } catch (err) {
      setError('Erro ao validar credenciais')
      return false
    } finally {
      setIsValidating(false)
    }
  }

  const validateStep = (): boolean => {
    switch (step) {
      case 1:
        if (data.password.length < 8) {
          setError('Senha deve ter pelo menos 8 caracteres')
          return false
        }
        if (data.password !== data.confirmPassword) {
          setError('Senhas não conferem')
          return false
        }
        break
      case 2:
        if (!data.supabaseUrl.startsWith('https://')) {
          setError('URL do Supabase deve começar com https://')
          return false
        }
        if (!data.supabaseAnonKey) {
          setError('Anon Key é obrigatória')
          return false
        }
        if (!data.supabaseServiceKey) {
          setError('Service Role Key é obrigatória')
          return false
        }
        break
      case 3:
        if (!data.redisUrl.startsWith('https://')) {
          setError('URL do Redis deve começar com https://')
          return false
        }
        if (!data.redisToken) {
          setError('Token do Redis é obrigatório')
          return false
        }
        if (!data.qstashToken) {
          setError('Token do QStash é obrigatório')
          return false
        }
        break
      case 4:
        if (!data.whatsappToken) {
          setError('Token do WhatsApp é obrigatório')
          return false
        }
        if (!data.whatsappPhoneId) {
          setError('Phone Number ID é obrigatório')
          return false
        }
        if (!data.whatsappBusinessId) {
          setError('Business Account ID é obrigatório')
          return false
        }
        break
      case 5:
        if (data.companyName.trim().length < 2) {
          setError('Nome da empresa deve ter pelo menos 2 caracteres')
          return false
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
          setError('E-mail inválido')
          return false
        }
        if (data.phone.replace(/\D/g, '').length < 10) {
          setError('Telefone inválido')
          return false
        }
        break
    }
    return true
  }

  const fetchSql = async () => {
    setLoadingSql(true)
    try {
      const res = await fetch('/api/setup/schema')
      const json = await res.json()
      if (json.sql) {
        setSqlContent(json.sql)
        setShowSql(true)
      }
    } catch (err) {
      console.error('Error fetching SQL:', err)
      setError('Erro ao carregar SQL')
    } finally {
      setLoadingSql(false)
    }
  }

  const checkDatabase = async () => {
    if (!data.databaseUrl) {
      setError('Connection string é necessária')
      return
    }

    setMigrating(true)
    setError('')
    setDbStatus(null)

    try {
      const res = await fetch('/api/setup/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: data.databaseUrl,
          action: 'check'
        })
      })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Erro ao verificar banco')

      if (json.exists) {
        setDbStatus('exists')
        setMigrating(false) // Wait for user choice
      } else {
        setDbStatus('clean')
        // Auto-run migration if clean
        await runMigration('migrate')
      }

    } catch (err: any) {
      console.error('Check error:', err)
      setError(err.message || 'Erro ao conectar ao banco')
      setMigrating(false)
    }
  }

  const runMigration = async (action: 'migrate' | 'reset' = 'migrate') => {
    if (!data.databaseUrl) {
      setError('Connection string é necessária para migração automática')
      return
    }

    setMigrating(true)
    setError('')
    try {
      const res = await fetch('/api/setup/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: data.databaseUrl,
          action
        })
      })

      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Falha na migração')

      // Migration successful - clear the "tables exist" state and mark as done
      setDbStatus(null)
      setMigrationSuccess(true)

    } catch (err: any) {
      console.error('Migration error:', err)
      setError(err.message || 'Erro ao aplicar migração')
    } finally {
      setMigrating(false)
    }
  }

  const handleNext = async () => {
    if (!validateStep()) return

    // Validate external services for steps 2, 3, 4
    if (step >= 2 && step <= 4) {
      const isValid = await validateCredentials()
      if (!isValid) return
    }

    if (step < 5) {
      setStep(step + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
      setError('')
    }
  }

  const handleSubmit = async () => {
    if (!projectInfo) return

    setIsLoading(true)
    setError('')

    try {
      // Check if we're in resume mode
      // CRITICAL: Only allow resume mode if Supabase is ACTUALLY configured on the server
      const statusRes = await fetch('/api/setup/env-status')
      const statusJson = await statusRes.json()

      const isServerConfigured =
        process.env.NEXT_PUBLIC_SUPABASE_URL || // Check locally if possible
        statusJson.steps.database // Check API status

      const isResumeMode = (!vercelToken || projectInfo.id === 'resumed') && isServerConfigured

      if (isResumeMode) {
        // Resume mode: Just save company info to database
        const response = await fetch('/api/setup/complete-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: data.companyName,
            email: data.email,
            phone: data.phone,
          })
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao salvar dados da empresa')
        }

        // Clear persisted state
        localStorage.removeItem('smartzap_setup_data')
        localStorage.removeItem('smartzap_setup_step')

        // Force hard reload to ensure cookies are picked up by middleware
        window.location.replace('/login')
        return
      }

      // If we fall through to here, we need to do a full setup.
      // But if we don't have the Vercel Token, we can't!
      if (!vercelToken) {
        // Redirect to start to get the token again
        setError('Token Vercel expirou. Redirecionando para reconectar...')
        setTimeout(() => router.push('/setup/start'), 2000)
        return
      }

      // Full setup mode: Save all env vars to Vercel and trigger redeploy
      const response = await fetch('/api/setup/save-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: vercelToken,
          projectId: projectInfo.id,
          teamId: projectInfo.teamId,
          envVars: {
            MASTER_PASSWORD: data.password,
            NEXT_PUBLIC_SUPABASE_URL: data.supabaseUrl,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: data.supabaseAnonKey,
            SUPABASE_SERVICE_ROLE_KEY: data.supabaseServiceKey,
            UPSTASH_REDIS_REST_URL: data.redisUrl,
            UPSTASH_REDIS_REST_TOKEN: data.redisToken,
            QSTASH_TOKEN: data.qstashToken,
            UPSTASH_EMAIL: data.upstashEmail,
            UPSTASH_API_KEY: data.upstashApiKey,
            UPSTASH_CONSOLE_URL: data.upstashConsoleUrl,
            WHATSAPP_TOKEN: data.whatsappToken,
            WHATSAPP_PHONE_ID: data.whatsappPhoneId,
            WHATSAPP_BUSINESS_ACCOUNT_ID: data.whatsappBusinessId,
            // Setup metadata for future resume mode
            SETUP_COMPLETE: 'true',
            VERCEL_PROJECT_ID: projectInfo.id,
            // Temporary: Company info to be saved to DB after redeploy
            SETUP_COMPANY_NAME: data.companyName,
            SETUP_COMPANY_EMAIL: data.email,
            SETUP_COMPANY_PHONE: data.phone,
          }
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar configuração')
      }

      // Clear wizard-specific state
      localStorage.removeItem('smartzap_setup_data')
      localStorage.removeItem('smartzap_setup_step')
      localStorage.removeItem('setup_token')
      localStorage.removeItem('setup_project')
      localStorage.removeItem('setup_deployment')

      // Show success message
      setIsLoading(false)
      setError('')
      setSetupComplete(true)

      // Redirect to login after 90 seconds (give time for redeploy)
      setTimeout(() => {
        window.location.replace('/login')
      }, 90000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configuração')
    } finally {
      setIsLoading(false)
    }
  }

  // Success state - show completion message
  if (setupComplete) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/20 mb-6">
            <Check className="w-10 h-10 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Setup Concluído!
          </h1>
          <p className="text-zinc-400 mb-8">
            Suas variáveis foram salvas e o deploy foi iniciado.
            <br />
            Aguarde 90 segundos para ser redirecionado automaticamente.
          </p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-sm text-zinc-500 mb-2">Ou acesse manualmente:</p>
            <a
              href="/login"
              className="text-blue-500 hover:underline font-medium"
            >
              https://smartzapv.vercel.app/login
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!projectInfo) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
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
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step > s.id ? 'bg-blue-500' : step === s.id ? 'bg-blue-600' : 'bg-zinc-800'
                }`}>
                {step > s.id ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <s.icon className={`w-4 h-4 ${step === s.id ? 'text-white' : 'text-zinc-500'}`} />
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-0.5 ${step > s.id ? 'bg-blue-500' : 'bg-zinc-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          {/* Step 1: Password */}
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">
                Crie sua senha de acesso
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Use uma senha forte com pelo menos 8 caracteres
              </p>

              <div className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={data.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="Senha"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-11 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={data.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
                    placeholder="Confirmar senha"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {data.confirmPassword && data.password === data.confirmPassword && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500" />
                  )}
                </div>

                {/* Password strength indicator */}
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${data.password.length >= i * 3
                        ? data.password.length >= 12
                          ? 'bg-blue-500'
                          : data.password.length >= 8
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        : 'bg-zinc-700'
                        }`}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 2: Turso */}
          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">
                Supabase Database
              </h2>
              <p className="text-zinc-400 text-sm mb-4">
                Configure o seu projeto Supabase
              </p>

              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-500 text-sm hover:underline mb-6"
              >
                Acessar Supabase Dashboard <ExternalLink className="w-3 h-3" />
              </a>

              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                    <Terminal className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-blue-200 mb-1">Configuração do Banco</h3>
                    <p className="text-xs text-zinc-400 mb-3">
                      É necessário criar as tabelas no Supabase. Copie o SQL e execute no SQL Editor do dashboard.
                    </p>
                    <button
                      onClick={fetchSql}
                      disabled={loadingSql}
                      className="text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-3 py-2 rounded-md transition-colors flex items-center gap-2"
                    >
                      {loadingSql ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileJson className="w-3 h-3" />}
                      Ver SQL de Inicialização
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Project URL</label>
                  <input
                    type="text"
                    value={data.supabaseUrl}
                    onChange={(e) => updateField('supabaseUrl', e.target.value)}
                    placeholder="https://your-project.supabase.co"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Anon Key (Public)</label>
                  <input
                    type="password"
                    value={data.supabaseAnonKey}
                    onChange={(e) => updateField('supabaseAnonKey', e.target.value)}
                    placeholder="eyJhbG..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Service Role Key (Secret)</label>
                  <input
                    type="password"
                    value={data.supabaseServiceKey}
                    onChange={(e) => updateField('supabaseServiceKey', e.target.value)}
                    placeholder="eyJhbG..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Usada para tarefas administrativas no backend.</p>
                </div>

                <div className="pt-4 mt-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm text-zinc-300 font-medium">Automação (Opcional)</label>
                  </div>
                  <p className="text-xs text-zinc-500 mb-3">
                    Se fornecer a Connection String, podemos criar as tabelas automaticamente para você.
                  </p>

                  <div className="space-y-4">
                    <div className="relative">
                      <input
                        type="password"
                        value={data.databaseUrl || ''}
                        onChange={(e) => updateField('databaseUrl', e.target.value)}
                        placeholder="postgres://postgres.xxx:pass@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                      <div className="absolute -bottom-5 left-0 text-[10px] text-zinc-500">
                        Use o "Connection Pooler" (porta 6543) para melhor compatibilidade
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-2">
                      {dbStatus === 'exists' ? (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-left-4 duration-300 w-full justify-end">
                          <button
                            onClick={() => {
                              if (resetConfirm) {
                                runMigration('reset')
                                setResetConfirm(false)
                              } else {
                                setResetConfirm(true)
                                setTimeout(() => setResetConfirm(false), 4000)
                              }
                            }}
                            disabled={migrating}
                            className={`flex-1 py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${resetConfirm
                              ? 'bg-red-500 text-white'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                              }`}
                          >
                            {resetConfirm ? 'Confirmar Reset' : 'Resetar Banco'}
                          </button>

                          <button
                            onClick={() => runMigration('migrate')}
                            disabled={migrating}
                            className="flex-1 py-3 rounded-xl font-medium transition-all duration-300 bg-blue-500 hover:bg-blue-400 text-white flex items-center justify-center gap-2"
                          >
                            {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Manter Dados
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={checkDatabase}
                          disabled={migrating || !data.databaseUrl}
                          className={`w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${migrationSuccess
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                            }`}
                        >
                          {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> :
                            migrationSuccess ? <Check className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                          {migrationSuccess ? 'Conectado!' : 'Conectar Banco'}
                        </button>
                      )}
                    </div>
                  </div>

                  {dbStatus === 'exists' && !migrating && !migrationSuccess && (
                    <p className="text-xs text-amber-400 mt-2">
                      ⚠️ Tabelas detectadas no banco. Escolha se deseja manter ou resetar.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Step 3: Upstash */}
          {step === 3 && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">
                Upstash Redis & QStash
              </h2>
              <p className="text-zinc-400 text-sm mb-4">
                Configure cache e filas de mensagens
              </p>

              <a
                href="https://console.upstash.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-500 text-sm hover:underline mb-6"
              >
                Acessar Upstash Console <ExternalLink className="w-3 h-3" />
              </a>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Redis REST URL</label>
                  <input
                    type="text"
                    value={data.redisUrl}
                    onChange={(e) => updateField('redisUrl', e.target.value)}
                    placeholder="https://...upstash.io"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Redis REST Token</label>
                  <input
                    type="password"
                    value={data.redisToken}
                    onChange={(e) => updateField('redisToken', e.target.value)}
                    placeholder="AX..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">QStash Token</label>
                  <input
                    type="password"
                    value={data.qstashToken}
                    onChange={(e) => updateField('qstashToken', e.target.value)}
                    placeholder="eyJ..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>

                <div className="pt-4 mt-4 border-t border-zinc-800">
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">
                    Estatísticas de Uso (Opcional)
                  </h3>
                  <p className="text-xs text-zinc-500 mb-4">
                    Para exibir estatísticas reais de uso do Redis no dashboard, informe suas credenciais de gerenciamento.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Upstash Email</label>
                      <input
                        type="email"
                        value={data.upstashEmail}
                        onChange={(e) => updateField('upstashEmail', e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Management API Key</label>
                      <input
                        type="password"
                        value={data.upstashApiKey}
                        onChange={(e) => updateField('upstashApiKey', e.target.value)}
                        placeholder="Obter em Account > Management API"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Console URL</label>
                      <input
                        type="text"
                        value={data.upstashConsoleUrl}
                        onChange={(e) => updateField('upstashConsoleUrl', e.target.value)}
                        placeholder="https://console.upstash.com/redis/..."
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                      <p className="text-xs text-zinc-500 mt-1">Usado para identificar o ID do banco de dados automaticamente.</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 4: WhatsApp */}
          {step === 4 && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">
                WhatsApp Cloud API
              </h2>
              <p className="text-zinc-400 text-sm mb-4">
                Configure a integração com WhatsApp
              </p>

              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-500 text-sm hover:underline mb-6"
              >
                Meta for Developers <ExternalLink className="w-3 h-3" />
              </a>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Phone Number ID</label>
                  <input
                    type="text"
                    value={data.whatsappPhoneId}
                    onChange={(e) => updateField('whatsappPhoneId', e.target.value)}
                    placeholder="1234567890"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Business Account ID</label>
                  <input
                    type="text"
                    value={data.whatsappBusinessId}
                    onChange={(e) => updateField('whatsappBusinessId', e.target.value)}
                    placeholder="1234567890"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Access Token</label>
                  <input
                    type="password"
                    value={data.whatsappToken}
                    onChange={(e) => updateField('whatsappToken', e.target.value)}
                    placeholder="EAA..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 5: Company */}
          {step === 5 && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">
                Dados da empresa
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                Informações que aparecerão no painel
              </p>

              <div className="space-y-4">
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    value={data.companyName}
                    onChange={(e) => updateField('companyName', e.target.value)}
                    placeholder="Nome da empresa"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="email"
                    value={data.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="E-mail"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500" />
                  )}
                </div>

                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="tel"
                    value={data.phone}
                    onChange={(e) => updateField('phone', formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {data.phone.replace(/\D/g, '').length >= 10 && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500" />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isLoading || isValidating}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={isLoading || isValidating}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : isValidating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  {step < 5 ? 'Continuar' : 'Finalizar'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-sm mt-6">
          SmartZap © {new Date().getFullYear()}
        </p>
      </div>
      {/* SQL Modal */}
      {showSql && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Database className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Schema SQL</h3>
                  <p className="text-xs text-zinc-400">Copie e execute no Supabase SQL Editor</p>
                </div>
              </div>
              <button
                onClick={() => setShowSql(false)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-0 bg-zinc-950/50">
              <pre className="p-4 text-xs font-mono text-zinc-300 leading-relaxed">
                {sqlContent}
              </pre>
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-end gap-3">
              <button
                onClick={() => setShowSql(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sqlContent)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${copied
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar SQL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  )
}

export default function WizardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    }>
      <WizardContent />
    </Suspense>
  )
}
