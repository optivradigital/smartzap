'use client'

/**
 * Conversations Page
 * 
 * Inbox de conversas para gerenciar atendimentos
 */

import { useState } from 'react'
import { MessageSquare, Filter, RefreshCw } from 'lucide-react'
import { useConversationsController } from '@/hooks/useConversations'
import { ConversationListView, ConversationDetailView } from '@/components/features/conversations'

const statusOptions = [
  { value: undefined, label: 'Todas' },
  { value: 'active' as const, label: 'Ativas' },
  { value: 'paused' as const, label: 'Em atendimento' },
  { value: 'ended' as const, label: 'Encerradas' },
]

export default function ConversationsPage() {
  const {
    conversations,
    total,
    hasMore,
    isListLoading,
    isLoadingMore,
    loadMore,
    selectedId,
    setSelectedId,
    selectedConversation,
    selectedMessages,
    selectedVariables,
    isDetailLoading,
    statusFilter,
    setStatusFilter,
    takeover,
    release,
    sendMessage,
    endConversation,
    isTakingOver,
    isReleasing,
    isSending,
    isEnding,
    refetchList,
    refetchDetail,
  } = useConversationsController()
  
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([refetchList(), refetchDetail()])
    setIsRefreshing(false)
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <header className="px-6 py-4 border-b border-border bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-primary-400" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">Conversas</h1>
              <p className="text-xs text-muted-foreground">
                {total} conversa{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={statusFilter || ''}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter || undefined)}
                className="px-3 py-1.5 bg-muted dark:bg-zinc-800 border border-border dark:border-zinc-700 rounded-lg
                         text-sm text-foreground
                         focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value || ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-zinc-800
                       rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List (Left Panel) */}
        <aside className="w-80 border-r border-border overflow-y-auto bg-muted/30 dark:bg-zinc-900/30">
          <ConversationListView
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isLoading={isListLoading}
            total={total}
            hasMore={hasMore}
            onLoadMore={loadMore}
            isLoadingMore={isLoadingMore}
          />
        </aside>
        
        {/* Conversation Detail (Right Panel) */}
        <main className="flex-1 overflow-hidden bg-background">
          <ConversationDetailView
            conversation={selectedConversation}
            messages={selectedMessages}
            variables={selectedVariables}
            isLoading={isDetailLoading && !!selectedId}
            onTakeover={takeover}
            onRelease={release}
            onSendMessage={sendMessage}
            onEnd={endConversation}
            isTakingOver={isTakingOver}
            isReleasing={isReleasing}
            isSending={isSending}
            isEnding={isEnding}
          />
        </main>
      </div>
    </div>
  )
}
