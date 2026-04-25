'use client'

import React from 'react'
import {
  Zap,
  Database,
  MessageCircle,
  Server,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  Send
} from 'lucide-react'

interface UsageData {
  vercel: {
    plan?: 'hobby' | 'pro' | 'enterprise' | 'unknown'
    functionInvocations: number
    functionLimit: number
    functionPercentage: number
    edgeRequests: number
    edgeLimit: number
    edgePercentage: number
    buildMinutes: number
    buildLimit: number
    buildPercentage: number
    percentage: number
    status: 'ok' | 'warning' | 'critical'
  }
  redis: {
    commandsToday: number
    limit: number
    percentage: number
    status: 'ok' | 'warning' | 'critical'
  }
  database: {
    plan?: 'free' | 'pro' | 'team' | 'enterprise' | 'unknown'
    storageMB: number
    limitMB: number
    bandwidthMB?: number
    bandwidthLimitMB?: number
    percentage: number
    status: 'ok' | 'warning' | 'critical'
  }
  whatsapp: {
    messagesSent: number
    tier: string
    tierLimit: number
    percentage: number
    quality: string
    status: 'ok' | 'warning' | 'critical'
  }
  qstash?: {
    messagesMonth: number
    messagesLimit: number
    percentage: number
    cost: number
    status: 'ok' | 'warning' | 'critical'
  }
}

interface UsagePanelProps {
  usage: UsageData | null
  isLoading: boolean
  onRefresh: () => void
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

const StatusIcon = ({ status }: { status: 'ok' | 'warning' | 'critical' }) => {
  if (status === 'ok') return <CheckCircle2 size={14} className="text-blue-400" />
  if (status === 'warning') return <AlertTriangle size={14} className="text-amber-400" />
  return <AlertTriangle size={14} className="text-red-400" />
}

const ProgressBar = ({
  percentage,
  status
}: {
  percentage: number
  status: 'ok' | 'warning' | 'critical'
}) => {
  const colors = {
    ok: 'bg-blue-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
  }

  return (
    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${colors[status]} transition-all duration-500`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  )
}

const UsageItem = ({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  value,
  limit,
  percentage,
  status,
  helpText,
  upgradeUrl,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  iconColor: string
  title: string
  subtitle: string
  value: string
  limit: string
  percentage: number
  status: 'ok' | 'warning' | 'critical'
  helpText?: string
  upgradeUrl?: string
}) => {
  return (
    <div className={`p-4 rounded-xl border transition-all ${status === 'critical'
      ? 'bg-red-500/5 border-red-500/20'
      : status === 'warning'
        ? 'bg-amber-500/5 border-amber-500/20'
        : 'bg-zinc-900/50 border-white/10'
      }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-zinc-800 ${iconColor}`}>
            <Icon size={18} />
          </div>
          <div>
            <h4 className="font-medium text-white text-sm">{title}</h4>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        <StatusIcon status={status} />
      </div>

      <div className="space-y-2">
        <ProgressBar percentage={percentage} status={status} />

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">
            <span className="font-mono text-white">{value}</span>
            <span className="text-gray-600"> / {limit}</span>
          </span>
          <span className={`font-medium ${status === 'critical'
            ? 'text-red-400'
            : status === 'warning'
              ? 'text-amber-400'
              : 'text-blue-400'
            }`}>
            {percentage.toFixed(1)}%
          </span>
        </div>

        {helpText && (
          <p className={`text-xs mt-2 ${status === 'critical'
            ? 'text-red-400'
            : status === 'warning'
              ? 'text-amber-400'
              : 'text-gray-500'
            }`}>
            {status === 'critical' ? '⚠️ ' : status === 'warning' ? '⚡ ' : '✓ '}
            {helpText}
          </p>
        )}

        {(status === 'warning' || status === 'critical') && upgradeUrl && (
          <a
            href={upgradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            <TrendingUp size={12} />
            Aumentar limite
            <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  )
}

export const UsagePanel: React.FC<UsagePanelProps> = ({ usage, isLoading, onRefresh }) => {
  if (isLoading && !usage) {
    return (
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-center h-48">
          <RefreshCw size={24} className="text-gray-500 animate-spin" />
        </div>
      </div>
    )
  }

  if (!usage) {
    return (
      <div className="glass-panel p-6 rounded-2xl">
        <div className="text-center text-gray-500 py-8">
          Não foi possível carregar os dados de uso.
          <button
            onClick={onRefresh}
            className="block mx-auto mt-4 text-primary-400 hover:text-primary-300"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const getHelpText = (type: string, status: 'ok' | 'warning' | 'critical', percentage: number) => {
    if (type === 'vercel') {
      if (status === 'critical') return 'Limite quase atingido! Considere upgrade.'
      if (status === 'warning') return 'Atenção ao uso de execuções.'
      return 'Dentro do plano'
    }
    if (type === 'redis') {
      if (status === 'critical') return 'Limite diário quase atingido!'
      if (status === 'warning') return 'Uso elevado hoje'
      return 'Limite diário OK'
    }
    if (type === 'turso') {
      if (status === 'critical') return 'Armazenamento quase cheio!'
      if (status === 'warning') return 'Monitorar espaço'
      return 'Espaço de sobra'
    }
    if (type === 'whatsapp') {
      if (status === 'critical') return 'Próximo do limite do tier!'
      if (status === 'warning') return 'Próximo do limite do tier atual'
      return `Qualidade: ${usage.whatsapp.quality}`
    }
    return ''
  }

  return (
    <div className="glass-panel p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Uso da Infraestrutura</h3>
          <p className="text-sm text-gray-500">Este mês</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid gap-4">
        {/* Vercel - Expanded view with 3 metrics */}
        <div className={`p-4 rounded-xl border transition-all ${usage.vercel.status === 'critical'
          ? 'bg-red-500/5 border-red-500/20'
          : usage.vercel.status === 'warning'
            ? 'bg-amber-500/5 border-amber-500/20'
            : 'bg-zinc-900/50 border-white/10'
          }`}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-800 text-amber-400">
                <Zap size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-white text-sm">Vercel</h4>
                  {usage.vercel.plan && usage.vercel.plan !== 'unknown' && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded ${usage.vercel.plan === 'enterprise' ? 'bg-purple-500/20 text-purple-300' :
                      usage.vercel.plan === 'pro' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-zinc-700 text-zinc-300'
                      }`}>
                      {usage.vercel.plan}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">Uso mensal</p>
              </div>
            </div>
            <StatusIcon status={usage.vercel.status} />
          </div>

          {/* Function Invocations */}
          <div className="space-y-1 mb-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Invocações</span>
              <span className="text-gray-400">
                <span className="font-mono text-white">{formatNumber(usage.vercel.functionInvocations)}</span>
                <span className="text-gray-600"> / {formatNumber(usage.vercel.functionLimit)}</span>
              </span>
            </div>
            <ProgressBar percentage={usage.vercel.functionPercentage} status={
              usage.vercel.functionPercentage >= 90 ? 'critical'
                : usage.vercel.functionPercentage >= 70 ? 'warning'
                  : 'ok'
            } />
          </div>

          {/* Edge Requests */}
          <div className="space-y-1 mb-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Edge Requests</span>
              <span className="text-gray-400">
                <span className="font-mono text-white">{formatNumber(usage.vercel.edgeRequests)}</span>
                <span className="text-gray-600"> / {formatNumber(usage.vercel.edgeLimit)}</span>
              </span>
            </div>
            <ProgressBar percentage={usage.vercel.edgePercentage} status={
              usage.vercel.edgePercentage >= 90 ? 'critical'
                : usage.vercel.edgePercentage >= 70 ? 'warning'
                  : 'ok'
            } />
          </div>

          {/* Build Minutes */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Build (min)</span>
              <span className="text-gray-400">
                <span className="font-mono text-white">{formatNumber(usage.vercel.buildMinutes)}</span>
                <span className="text-gray-600"> / {formatNumber(usage.vercel.buildLimit)}</span>
              </span>
            </div>
            <ProgressBar percentage={usage.vercel.buildPercentage} status={
              usage.vercel.buildPercentage >= 90 ? 'critical'
                : usage.vercel.buildPercentage >= 70 ? 'warning'
                  : 'ok'
            } />
          </div>

          {(usage.vercel.status === 'warning' || usage.vercel.status === 'critical') && (
            <a
              href="https://vercel.com/dashboard/usage"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              <TrendingUp size={12} />
              Ver detalhes
              <ExternalLink size={10} />
            </a>
          )}
        </div>

        <UsageItem
          icon={Database}
          iconColor="text-red-400"
          title="Redis"
          subtitle="Comandos/dia"
          value={formatNumber(usage.redis.commandsToday)}
          limit={usage.redis.limit === 0 ? 'Unlimited' : formatNumber(usage.redis.limit)}
          percentage={usage.redis.percentage}
          status={usage.redis.status}
          helpText={usage.redis.limit === 0 ? 'Plano pago - sem limite diário' : getHelpText('redis', usage.redis.status, usage.redis.percentage)}
          upgradeUrl="https://console.upstash.com"
        />

        {/* QStash */}
        {usage.qstash && (
          <UsageItem
            icon={Send}
            iconColor="text-violet-400"
            title="QStash"
            subtitle={usage.qstash.messagesLimit === 0 ? 'Pay-as-you-go' : 'Mensagens/mês'}
            value={formatNumber(usage.qstash.messagesMonth)}
            limit={usage.qstash.messagesLimit === 0 ? 'Unlimited' : formatNumber(usage.qstash.messagesLimit)}
            percentage={usage.qstash.percentage}
            status={usage.qstash.status}
            helpText={(usage.qstash?.cost ?? 0) > 0 ? `Custo: $${(usage.qstash?.cost ?? 0).toFixed(3)}` : '✓ Dentro do limite gratuito'}
            upgradeUrl="https://console.upstash.com/qstash"
          />
        )}

        {/* Database - Custom section with plan badge */}
        <div className={`p-4 rounded-xl border transition-all ${usage.database.status === 'critical'
          ? 'bg-red-500/5 border-red-500/20'
          : usage.database.status === 'warning'
            ? 'bg-amber-500/5 border-amber-500/20'
            : 'bg-zinc-900/50 border-white/10'
          }`}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-800 text-cyan-400">
                <Database size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-white text-sm">Database</h4>
                  {usage.database.plan && usage.database.plan !== 'unknown' && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded ${usage.database.plan === 'enterprise' ? 'bg-purple-500/20 text-purple-300' :
                      usage.database.plan === 'team' ? 'bg-indigo-500/20 text-indigo-300' :
                        usage.database.plan === 'pro' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-zinc-700 text-zinc-300'
                      }`}>
                      {usage.database.plan}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">Supabase</p>
              </div>
            </div>
            <StatusIcon status={usage.database.status} />
          </div>
          <div className="space-y-2">
            <ProgressBar percentage={usage.database.percentage} status={usage.database.status} />
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">
                <span className="font-mono text-white">{usage.database.storageMB}MB</span>
                <span className="text-gray-600"> / {usage.database.limitMB >= 1000 ? `${(usage.database.limitMB / 1000).toFixed(0)}GB` : `${usage.database.limitMB}MB`}</span>
              </span>
              <span className={`font-medium ${usage.database.status === 'critical' ? 'text-red-400' :
                usage.database.status === 'warning' ? 'text-amber-400' :
                  'text-blue-400'
                }`}>
                {(usage.database?.percentage ?? 0).toFixed(1)}%
              </span>
            </div>

            {/* Bandwidth Row */}
            {usage.database.bandwidthMB !== undefined && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">Bandwidth (egress)</span>
                  <span className="text-gray-400">
                    <span className="font-mono text-white">{(usage.database?.bandwidthMB ?? 0) < 1 ? `${Math.round((usage.database?.bandwidthMB ?? 0) * 1024)}KB` : `${(usage.database?.bandwidthMB ?? 0).toFixed(1)}MB`}</span>
                    <span className="text-gray-600"> / {(usage.database?.bandwidthLimitMB ?? 0) >= 1000 ? `${((usage.database?.bandwidthLimitMB ?? 0) / 1000).toFixed(0)}GB` : `${usage.database?.bandwidthLimitMB ?? 0}MB`}</span>
                  </span>
                </div>
                <ProgressBar
                  percentage={usage.database.bandwidthLimitMB ? Math.round(((usage.database.bandwidthMB || 0) / usage.database.bandwidthLimitMB) * 100 * 10) / 10 : 0}
                  status={usage.database.bandwidthLimitMB && ((usage.database.bandwidthMB || 0) / usage.database.bandwidthLimitMB) > 0.8 ? 'warning' : 'ok'}
                />
              </div>
            )}

            <p className={`text-xs mt-2 ${usage.database.status === 'critical' ? 'text-red-400' :
              usage.database.status === 'warning' ? 'text-amber-400' :
                'text-gray-500'
              }`}>
              {usage.database.status === 'critical' ? '⚠️ Armazenamento quase cheio!' :
                usage.database.status === 'warning' ? '⚡ Monitorar espaço' :
                  '✓ Espaço de sobra'}
            </p>
          </div>
        </div>

        <UsageItem
          icon={MessageCircle}
          iconColor="text-green-400"
          title="WhatsApp"
          subtitle={`Tier: ${formatNumber(usage.whatsapp.tierLimit)}/dia`}
          value={formatNumber(usage.whatsapp.messagesSent)}
          limit={formatNumber(usage.whatsapp.tierLimit)}
          percentage={usage.whatsapp.percentage}
          status={usage.whatsapp.status}
          helpText={getHelpText('whatsapp', usage.whatsapp.status, usage.whatsapp.percentage)}
        />
      </div>

      {/* Dica de upgrade */}
      {usage.whatsapp.status === 'warning' && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-xs text-amber-300">
            💡 <strong>Dica:</strong> Você pode subir pro próximo tier do WhatsApp
            enviando mais {formatNumber(usage.whatsapp.tierLimit - usage.whatsapp.messagesSent)} mensagens com boa qualidade.
          </p>
        </div>
      )}
    </div>
  )
}
