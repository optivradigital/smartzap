'use client'

import { Check, CheckCheck, Clock, AlertCircle, Megaphone } from 'lucide-react'
import type { BotMessage } from '@/types'

interface MessageBubbleProps {
  message: BotMessage
}

const originLabels: Record<string, string> = {
  client: 'Cliente',
  bot: 'Bot',
  operator: 'Atendente',
  ai: 'Demi (IA)',
}

const originColors: Record<string, string> = {
  client:   'bg-zinc-200 dark:bg-zinc-800',
  bot:      'bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800/50',
  operator: 'bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50',
  ai:       'bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/50',
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'sent':      return <Check className="w-3.5 h-3.5 text-muted-foreground" />
    case 'delivered': return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
    case 'read':      return <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
    case 'failed':    return <AlertCircle className="w-3.5 h-3.5 text-red-400" />
    default:          return <Clock className="w-3.5 h-3.5 text-muted-foreground" />
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'agora'
  if (diffMins < 60) return `${diffMins}min`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function TemplateBubble({ message }: { message: BotMessage }) {
  const content = message.content as Record<string, unknown>
  const templateName = content.templateName as string || 'template'

  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50">
        <div className="flex items-center gap-2 mb-1.5">
          <Megaphone className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            Disparo de campanha
          </span>
        </div>
        <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium">
          📤 Template enviado: <span className="text-amber-600 dark:text-amber-300">{templateName}</span>
        </p>
        <div className="flex items-center gap-1.5 mt-1 justify-end">
          <span className="text-[10px] text-muted-foreground">
            {message.createdAt ? formatTime(message.createdAt) : ''}
          </span>
          <StatusIcon status={message.status} />
        </div>
      </div>
    </div>
  )
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.type === 'template') {
    return <TemplateBubble message={message} />
  }

  const isInbound = message.direction === 'inbound'
  const bgColor = originColors[message.origin] || 'bg-zinc-200 dark:bg-zinc-800'
  const originLabel = originLabels[message.origin] || message.origin

  const getMessageText = () => {
    if (typeof message.content === 'string') return message.content
    if (message.content?.text) return message.content.text as string
    if (message.content?.body) return message.content.body as string
    return JSON.stringify(message.content)
  }

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`
          max-w-[75%] rounded-2xl px-4 py-2.5
          ${bgColor}
          ${isInbound ? 'rounded-tl-sm' : 'rounded-tr-sm'}
        `}
      >
        {!isInbound && message.origin !== 'client' && (
          <p className="text-[10px] font-medium text-muted-foreground mb-1">
            {originLabel}
          </p>
        )}

        <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
          {getMessageText()}
        </p>

        <div className={`flex items-center gap-1.5 mt-1 ${isInbound ? 'justify-start' : 'justify-end'}`}>
          <span className="text-[10px] text-muted-foreground">
            {message.createdAt ? formatTime(message.createdAt) : ''}
          </span>
          {!isInbound && <StatusIcon status={message.status} />}
        </div>

        {message.status === 'failed' && message.error && (
          <p className="text-[10px] text-red-500 dark:text-red-400 mt-1">
            {message.error}
          </p>
        )}
      </div>
    </div>
  )
}
