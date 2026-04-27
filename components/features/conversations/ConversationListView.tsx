'use client'

/**
 * ConversationListView Component
 * 
 * Lista de conversas com status, filtros e paginação
 */

import { MessageSquare, Bot, User, Clock, Pause, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react'
import type { BotConversation } from '@/types'

interface ConversationListViewProps {
  conversations: (BotConversation & { botName: string })[]
  selectedId: string | null
  onSelect: (id: string) => void
  isLoading?: boolean
  // Paginação
  total?: number
  hasMore?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
}

const statusConfig = {
  active: {
    icon: MessageSquare,
    label: 'Ativa',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  paused: {
    icon: Pause,
    label: 'Em atendimento',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  ended: {
    icon: CheckCircle2,
    label: 'Encerrada',
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-500/10',
  },
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: BotConversation & { botName: string }
  isSelected: boolean
  onClick: () => void
}) {
  const config = statusConfig[conversation.status] || statusConfig.active
  const StatusIcon = config.icon
  
  // Formatar tempo
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'agora'
    if (diffMins < 60) return `${diffMins}min`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d`
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }
  
  const lastActivityTime = conversation.lastMessageAt || conversation.createdAt
  
  return (
    <button
      onClick={onClick}
      className={`
        w-full p-4 text-left transition-colors
        border-b border-border dark:border-zinc-800
        ${isSelected
          ? 'bg-primary-500/10 dark:bg-primary-900/20 border-l-2 border-l-primary-500'
          : 'hover:bg-muted dark:hover:bg-zinc-800/50'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-muted dark:bg-zinc-700 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {conversation.contactPhone}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {conversation.contactName || 'Sem nome'}
            </p>
          </div>
        </div>

        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatTime(lastActivityTime)}
        </span>
      </div>
      
      {/* Bot info */}
      <div className="flex items-center gap-2 mt-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bot className="w-3 h-3" />
          <span className="truncate">{conversation.botName}</span>
        </div>
        
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${config.bgColor}`}>
          <StatusIcon className={`w-3 h-3 ${config.color}`} />
          <span className={`text-[10px] ${config.color}`}>{config.label}</span>
        </div>
      </div>
      
      {/* Message count */}
      {conversation.messageCount && conversation.messageCount > 0 && (
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <MessageSquare className="w-3 h-3" />
          <span>{conversation.messageCount} mensagens</span>
        </div>
      )}
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <MessageSquare className="w-12 h-12 text-muted-foreground/40 mb-4" />
      <h3 className="text-sm font-medium text-foreground mb-1">
        Nenhuma conversa
      </h3>
      <p className="text-xs text-muted-foreground">
        Quando usuários interagirem com seus bots, as conversas aparecerão aqui
      </p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-0">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-4 border-b border-border animate-pulse">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-32" />
              <div className="h-3 bg-muted rounded w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function LoadMoreButton({
  onClick,
  isLoading,
  remaining,
}: {
  onClick: () => void
  isLoading?: boolean
  remaining: number
}) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="w-full p-3 flex items-center justify-center gap-2
               text-sm text-primary-400 hover:text-primary-300
               hover:bg-muted dark:hover:bg-zinc-800/50 transition-colors
               disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Carregando...</span>
        </>
      ) : (
        <>
          <ChevronDown className="w-4 h-4" />
          <span>Carregar mais ({remaining} restantes)</span>
        </>
      )}
    </button>
  )
}

export function ConversationListView({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  total,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: ConversationListViewProps) {
  if (isLoading) {
    return <LoadingSkeleton />
  }
  
  if (conversations.length === 0) {
    return <EmptyState />
  }
  
  const remaining = total ? total - conversations.length : 0
  
  return (
    <div className="flex flex-col">
      {/* Lista de conversas */}
      <div className="divide-y divide-zinc-800">
        {conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isSelected={conv.id === selectedId}
            onClick={() => onSelect(conv.id)}
          />
        ))}
      </div>
      
      {/* Botão carregar mais */}
      {hasMore && onLoadMore && (
        <LoadMoreButton
          onClick={onLoadMore}
          isLoading={isLoadingMore}
          remaining={remaining}
        />
      )}
      
      {/* Footer com contagem */}
      <div className="p-3 text-center text-xs text-zinc-500 border-t border-zinc-800">
        Exibindo {conversations.length} de {total || conversations.length} conversas
      </div>
    </div>
  )
}
