'use client'

/**
 * ConversationDetailView Component
 * 
 * Exibe detalhes de uma conversa com mensagens e ações
 */

import { useState, useRef, useEffect } from 'react'
import { 
  Send, 
  User, 
  Bot, 
  Phone, 
  Clock, 
  Pause, 
  Play, 
  XCircle,
  ChevronDown,
  Loader2
} from 'lucide-react'
import type { BotConversation, BotMessage } from '@/types'
import { MessageBubble } from './MessageBubble'

interface ConversationDetailViewProps {
  conversation: (BotConversation & { botName: string }) | null
  messages: BotMessage[]
  variables: Record<string, string>
  isLoading?: boolean
  onTakeover: (agentName?: string) => Promise<unknown>
  onRelease: () => Promise<unknown>
  onSendMessage: (text: string) => Promise<unknown>
  onEnd: () => Promise<unknown>
  isTakingOver?: boolean
  isReleasing?: boolean
  isSending?: boolean
  isEnding?: boolean
}

function ConversationHeader({
  conversation,
  onTakeover,
  onRelease,
  onEnd,
  isTakingOver,
  isReleasing,
  isEnding,
}: {
  conversation: BotConversation & { botName: string }
  onTakeover: () => void
  onRelease: () => void
  onEnd: () => void
  isTakingOver?: boolean
  isReleasing?: boolean
  isEnding?: boolean
}) {
  const isPaused = conversation.status === 'paused'
  const isEnded = conversation.status === 'ended'
  
  return (
    <div className="p-4 border-b border-border bg-muted/30 dark:bg-zinc-900">
      {/* Contact Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted dark:bg-zinc-700 flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">
              {conversation.contactName || conversation.contactPhone}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span>{conversation.contactPhone}</span>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {!isEnded && (
            <>
              {isPaused ? (
                <button
                  onClick={onRelease}
                  disabled={isReleasing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                           text-emerald-400 bg-emerald-500/10 rounded-lg
                           hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                >
                  {isReleasing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Devolver ao Bot
                </button>
              ) : (
                <button
                  onClick={onTakeover}
                  disabled={isTakingOver}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                           text-amber-400 bg-amber-500/10 rounded-lg
                           hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                >
                  {isTakingOver ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Pause className="w-3.5 h-3.5" />
                  )}
                  Assumir
                </button>
              )}
              
              <button
                onClick={onEnd}
                disabled={isEnding}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                         text-red-400 bg-red-500/10 rounded-lg
                         hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                {isEnding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                Encerrar
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Bot Info */}
      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
        <Bot className="w-3.5 h-3.5" />
        <span>{conversation.botName}</span>
        <span className="opacity-30">•</span>
        <Clock className="w-3.5 h-3.5" />
        <span>
          Iniciada em {new Date(conversation.createdAt).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  )
}

function MessageList({ messages }: { messages: BotMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <Bot className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-sm text-zinc-500">
            Nenhuma mensagem nesta conversa ainda
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

function MessageInput({
  onSend,
  isSending,
  disabled,
}: {
  onSend: (text: string) => void
  isSending?: boolean
  disabled?: boolean
}) {
  const [text, setText] = useState('')
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim() && !isSending && !disabled) {
      onSend(text.trim())
      setText('')
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-background">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? 'Assuma a conversa para enviar mensagens' : 'Digite sua mensagem...'}
          disabled={disabled}
          className="flex-1 px-4 py-2.5 bg-muted dark:bg-zinc-800 border border-border dark:border-zinc-700 rounded-lg
                   text-sm text-foreground placeholder:text-muted-foreground
                   focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                   disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!text.trim() || isSending || disabled}
          className="p-2.5 bg-primary-600 text-white rounded-lg
                   hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </form>
  )
}

function VariablesPanel({ variables }: { variables: Record<string, string> }) {
  const [isOpen, setIsOpen] = useState(false)
  const entries = Object.entries(variables)
  
  if (entries.length === 0) return null
  
  return (
    <div className="border-t border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 flex items-center justify-between text-xs text-muted-foreground hover:bg-muted dark:hover:bg-zinc-800/50"
      >
        <span>Variáveis coletadas ({entries.length})</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-4 py-2 bg-muted/50 dark:bg-zinc-800/30 space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="text-primary-400">{`{{${key}}}`}</span>
              <span className="text-muted-foreground/40">=</span>
              <span className="text-foreground">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <User className="w-16 h-16 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-2">
        Selecione uma conversa
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Escolha uma conversa da lista para ver as mensagens e gerenciar o atendimento
      </p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-border animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-3 bg-muted rounded w-24" />
          </div>
        </div>
      </div>
      <div className="flex-1 p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            <div className={`h-16 bg-muted rounded-2xl ${i % 2 === 0 ? 'w-48' : 'w-56'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ConversationDetailView({
  conversation,
  messages,
  variables,
  isLoading,
  onTakeover,
  onRelease,
  onSendMessage,
  onEnd,
  isTakingOver,
  isReleasing,
  isSending,
  isEnding,
}: ConversationDetailViewProps) {
  if (isLoading) {
    return <LoadingSkeleton />
  }
  
  if (!conversation) {
    return <EmptyState />
  }
  
  const canSendMessage = conversation.status === 'paused'
  
  return (
    <div className="flex flex-col h-full">
      <ConversationHeader
        conversation={conversation}
        onTakeover={() => onTakeover()}
        onRelease={onRelease}
        onEnd={onEnd}
        isTakingOver={isTakingOver}
        isReleasing={isReleasing}
        isEnding={isEnding}
      />
      
      <MessageList messages={messages} />
      
      <VariablesPanel variables={variables} />
      
      <MessageInput
        onSend={onSendMessage}
        isSending={isSending}
        disabled={!canSendMessage}
      />
    </div>
  )
}
