'use client'

/**
 * Deploying Page - Shows deployment progress
 * 
 * After saving env vars, we wait for the redeploy to complete
 * then save company info and redirect to login
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, AlertCircle, RefreshCw, Rocket } from 'lucide-react'

type DeploymentState = 'deploying' | 'ready' | 'error' | 'saving-company'

export default function DeployingPage() {
  const router = useRouter()
  const [state, setState] = useState<DeploymentState>('deploying')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('Iniciando deploy...')

  const checkDeploymentStatus = useCallback(async () => {
    const token = localStorage.getItem('setup_token')
    const deployment = localStorage.getItem('setup_deployment')
    const project = localStorage.getItem('setup_project')

    if (!token || !project) {
      setError('Dados de configuração não encontrados')
      setState('error')
      return false
    }

    // If no deployment info, assume it completed (edge case)
    if (!deployment) {
      console.log('No deployment info, assuming complete')
      return true
    }

    const deploymentData = JSON.parse(deployment)
    const deploymentId = deploymentData.id || deploymentData.uid

    if (!deploymentId) {
      console.log('No deployment ID, assuming complete')
      return true
    }

    const { teamId } = JSON.parse(project)

    try {
      const response = await fetch(
        `/api/setup/save-env?token=${token}&deploymentId=${deploymentId}${teamId ? `&teamId=${teamId}` : ''}`
      )

      if (!response.ok) {
        // If 404, deployment might have finished already
        if (response.status === 404) {
          console.log('Deployment not found, assuming complete')
          return true
        }
        throw new Error('Erro ao verificar status')
      }

      const data = await response.json()

      if (!data.deployment) {
        return true // No deployment info means it's done
      }

      switch (data.deployment.state) {
        case 'READY':
          return true
        case 'ERROR':
        case 'CANCELED':
          throw new Error('Deploy falhou')
        case 'BUILDING':
          setStatusMessage('Compilando projeto...')
          setProgress(50)
          break
        case 'INITIALIZING':
        case 'QUEUED':
          setStatusMessage('Na fila de deploy...')
          setProgress(20)
          break
        default:
          setProgress(30)
      }

      return false
    } catch (err) {
      console.error('Status check error:', err)
      throw err
    }
  }, [])

  const saveCompanyInfo = useCallback(async () => {
    try {
      // Call the new init-company endpoint that reads from env vars
      // This works because after redeploy, SETUP_COMPANY_* env vars are available
      const response = await fetch('/api/setup/init-company')
      const data = await response.json()

      if (!response.ok && data.error) {
        console.warn('Company init warning:', data.error)
      }

      return true
    } catch (err) {
      console.error('Save company error:', err)
      throw err
    }
  }, [])

  useEffect(() => {
    let pollInterval: NodeJS.Timeout
    let attempts = 0
    const maxAttempts = 60 // 5 minutes max (5s intervals)

    const poll = async () => {
      try {
        attempts++

        if (attempts > maxAttempts) {
          setError('Timeout aguardando deploy. Verifique no Vercel Dashboard.')
          setState('error')
          return
        }

        const isReady = await checkDeploymentStatus()

        if (isReady) {
          setStatusMessage('Deploy concluído!')
          setProgress(80)
          setState('saving-company')

          // Wait a moment for the new deployment to be fully ready
          await new Promise(resolve => setTimeout(resolve, 3000))

          setStatusMessage('Salvando dados da empresa...')

          try {
            await saveCompanyInfo()
            setProgress(100)
            setStatusMessage('Configuração concluída!')
            setState('ready')

            // Clean up localStorage
            localStorage.removeItem('setup_token')
            localStorage.removeItem('setup_project')
            localStorage.removeItem('setup_deployment')
            localStorage.removeItem('setup_company')

            // Redirect to login after a moment
            setTimeout(() => {
              router.push('/login')
            }, 2000)
          } catch (err) {
            // Even if company save fails, deployment is done
            // User can configure later
            console.error('Company save failed, continuing...', err)
            setProgress(100)
            setState('ready')
            setTimeout(() => router.push('/login'), 2000)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
        setState('error')
      }
    }

    // Initial check
    poll()

    // Poll every 5 seconds
    pollInterval = setInterval(poll, 5000)

    return () => clearInterval(pollInterval)
  }, [checkDeploymentStatus, saveCompanyInfo, router])

  const handleRetry = () => {
    setError('')
    setState('deploying')
    setProgress(0)
    setStatusMessage('Tentando novamente...')
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-blue-600 mb-4">
            <span className="text-3xl font-bold text-white">S</span>
          </div>
          <h1 className="text-2xl font-bold text-white">SmartZap</h1>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
          {state === 'error' ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Erro no deploy
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                {error}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Tentar novamente
                </button>
                <a
                  href="https://vercel.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center"
                >
                  Ver no Vercel
                </a>
              </div>
            </div>
          ) : state === 'ready' ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
                <Check className="w-8 h-8 text-blue-500" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Tudo pronto!
              </h2>
              <p className="text-zinc-400 text-sm">
                Redirecionando para o login...
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
                {state === 'saving-company' ? (
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                ) : (
                  <Rocket className="w-8 h-8 text-blue-500 animate-bounce" />
                )}
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">
                {state === 'saving-company' ? 'Finalizando...' : 'Fazendo deploy...'}
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                {statusMessage}
              </p>

              {/* Progress bar */}
              <div className="w-full bg-zinc-800 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-zinc-500 text-xs">
                Isso pode levar alguns minutos...
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-sm mt-6">
          SmartZap © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
