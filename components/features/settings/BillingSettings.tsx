'use client'

import { useState, useEffect } from 'react'
import { CreditCard, Zap, CheckCircle, AlertCircle, Plus, Minus } from 'lucide-react'

const BASE_PRICE = 129
const EXTRA_PRICE = 87

interface Subscription {
  status: string
  plan: string
  extra_numbers: number
  current_period_end: string | null
  cancel_at_period_end: boolean
}

export function BillingSettings() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [extraNumbers, setExtraNumbers] = useState(0)

  useEffect(() => {
    fetch('/api/billing/subscription')
      .then(r => r.json())
      .then(data => {
        setSubscription(data.subscription ?? null)
        setExtraNumbers(data.subscription?.extra_numbers ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === '1') {
      window.history.replaceState({}, '', '/settings/billing')
    }
  }, [])

  async function handleCheckout() {
    setRedirecting(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraNumbers }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setRedirecting(false)
    }
  }

  async function handlePortal() {
    setRedirecting(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setRedirecting(false)
    }
  }

  const isActive = subscription?.status === 'active'

  return (
    <section id="billing" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-400" />
          Plano &amp; Faturamento
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Gerencie sua assinatura do SmartZap</p>
      </div>

      {loading ? (
        <div className="h-32 bg-muted/50 rounded-xl animate-pulse" />
      ) : isActive ? (
        <ActiveSubscription
          subscription={subscription!}
          onPortal={handlePortal}
          redirecting={redirecting}
        />
      ) : (
        <PricingCard
          extraNumbers={extraNumbers}
          setExtraNumbers={setExtraNumbers}
          onCheckout={handleCheckout}
          redirecting={redirecting}
        />
      )}
    </section>
  )
}

function ActiveSubscription({
  subscription,
  onPortal,
  redirecting,
}: {
  subscription: Subscription
  onPortal: () => void
  redirecting: boolean
}) {
  const renewDate = subscription.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('pt-BR')
    : null

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
          <CheckCircle className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <p className="text-foreground font-medium">Plano SmartZap{subscription.extra_numbers > 0 ? ` + ${subscription.extra_numbers} número${subscription.extra_numbers > 1 ? 's' : ''} extra` : ''}</p>
          <p className="text-muted-foreground text-sm">
            {subscription.cancel_at_period_end
              ? `Cancela em ${renewDate}`
              : `Renova em ${renewDate}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <span className="text-2xl font-bold text-foreground">
          R$ {(BASE_PRICE + subscription.extra_numbers * EXTRA_PRICE).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
        </span>
        <span className="text-muted-foreground text-sm">/mês</span>
      </div>

      <button
        onClick={onPortal}
        disabled={redirecting}
        className="w-full bg-muted hover:bg-muted/80 disabled:opacity-60 text-foreground font-medium rounded-xl py-2.5 text-sm transition-colors"
      >
        {redirecting ? 'Redirecionando...' : 'Gerenciar assinatura'}
      </button>
    </div>
  )
}

function PricingCard({
  extraNumbers,
  setExtraNumbers,
  onCheckout,
  redirecting,
}: {
  extraNumbers: number
  setExtraNumbers: (n: number) => void
  onCheckout: () => void
  redirecting: boolean
}) {
  const total = BASE_PRICE + extraNumbers * EXTRA_PRICE

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <p className="text-foreground font-medium">Sem assinatura ativa</p>
          <p className="text-muted-foreground text-sm">Assine para continuar usando o SmartZap após o período de teste.</p>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-muted/50 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-400" />
          <span className="text-foreground font-medium">SmartZap Basic</span>
        </div>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" /> 1 número WhatsApp incluso</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Campanhas ilimitadas</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Agente IA incluso</li>
          <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" /> Suporte prioritário</li>
        </ul>

        <div className="border-t border-border pt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">R$ {BASE_PRICE}</span>
            <span className="text-muted-foreground text-sm">/mês</span>
          </div>
        </div>
      </div>

      {/* Extra numbers */}
      <div className="space-y-2">
        <label className="text-sm text-foreground font-medium">Números adicionais (R$ {EXTRA_PRICE}/mês cada)</label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExtraNumbers(Math.max(0, extraNumbers - 1))}
            className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-foreground font-medium w-6 text-center">{extraNumbers}</span>
          <button
            onClick={() => setExtraNumbers(extraNumbers + 1)}
            className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Total */}
      <div className="flex items-baseline gap-2 border-t border-border pt-4">
        <span className="text-muted-foreground text-sm">Total:</span>
        <span className="text-2xl font-bold text-foreground">R$ {total}</span>
        <span className="text-muted-foreground text-sm">/mês</span>
      </div>

      <button
        onClick={onCheckout}
        disabled={redirecting}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-xl py-3 text-sm transition-colors"
      >
        {redirecting ? 'Redirecionando para o pagamento...' : 'Assinar agora'}
      </button>
    </div>
  )
}
