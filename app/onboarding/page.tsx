'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, ArrowRight, MessageSquare, Smartphone, Zap } from 'lucide-react'

const steps = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao SmartZap!',
    desc: 'Em poucos minutos você estará enviando campanhas pelo WhatsApp. Vamos configurar tudo.',
    icon: Zap,
    color: 'emerald',
  },
  {
    id: 'whatsapp',
    title: 'Conecte seu WhatsApp',
    desc: 'Vá em Configurações → WhatsApp e conecte seu número escaneando o QR Code. Seu número permanece o mesmo.',
    icon: Smartphone,
    color: 'blue',
  },
  {
    id: 'campaign',
    title: 'Crie sua primeira campanha',
    desc: 'Importe contatos via CSV, escolha um template e dispare sua primeira campanha em minutos.',
    icon: MessageSquare,
    color: 'purple',
  },
]

const colorMap: Record<string, string> = {
  emerald: 'bg-blue-500/20 text-blue-400',
  blue: 'bg-blue-500/20 text-blue-400',
  purple: 'bg-purple-500/20 text-purple-400',
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const router = useRouter()
  const current = steps[step]
  const Icon = current.icon
  const isLast = step === steps.length - 1

  function next() {
    if (isLast) {
      router.push('/')
    } else {
      setStep(s => s + 1)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Progress */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-blue-500' : 'bg-zinc-800'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colorMap[current.color]}`}>
            <Icon className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <p className="text-zinc-500 text-sm font-medium">Passo {step + 1} de {steps.length}</p>
            <h2 className="text-2xl font-bold text-white">{current.title}</h2>
            <p className="text-zinc-400 leading-relaxed">{current.desc}</p>
          </div>

          {step === 0 && (
            <div className="bg-zinc-800/50 rounded-xl p-4 space-y-2">
              {steps.slice(1).map(s => {
                const SIcon = s.icon
                return (
                  <div key={s.id} className="flex items-center gap-3 text-sm text-zinc-400">
                    <CheckCircle className="w-4 h-4 text-zinc-600 shrink-0" />
                    <span>{s.title}</span>
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={next}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isLast ? 'Ir para o dashboard' : 'Próximo'}
            <ArrowRight className="w-4 h-4" />
          </button>

          {!isLast && (
            <button
              onClick={() => router.push('/')}
              className="w-full text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            >
              Pular por agora
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
