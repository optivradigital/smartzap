'use client'

/**
 * useConversations Hook
 * 
 * React Query hook for conversation management with pagination
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useState, useCallback, useMemo } from 'react'
import { conversationService, type ConversationListParams } from '@/services/conversationService'
import type { BotConversation, BotMessage } from '@/types'

// =============================================================================
// Query Keys
// =============================================================================

export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filters: Omit<ConversationListParams, 'offset'>) =>
    [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
  variables: (id: string) => [...conversationKeys.all, 'variables', id] as const,
}

// =============================================================================
// List Hook with Infinite Query (Pagination)
// =============================================================================

const DEFAULT_LIMIT = 20

export function useConversations(initialFilters: Omit<ConversationListParams, 'offset' | 'limit'> = {}) {
  const [filters, setFilters] = useState(initialFilters)

  const query = useInfiniteQuery({
    queryKey: conversationKeys.list(filters),
    queryFn: ({ pageParam = 0 }) => conversationService.getConversations({
      ...filters,
      limit: DEFAULT_LIMIT,
      offset: pageParam,
    }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined
      return lastPage.offset + lastPage.limit
    },
    initialPageParam: 0,
    refetchInterval: 30 * 1000,
  })

  // Derived state - flatten all pages
  const conversations = useMemo(() => {
    return query.data?.pages.flatMap(page => page.conversations) || []
  }, [query.data])

  const total = query.data?.pages[0]?.total || 0
  const hasMore = query.hasNextPage || false

  // Filter handlers
  const setStatus = useCallback((status: 'active' | 'paused' | 'ended' | undefined) => {
    setFilters(prev => ({ ...prev, status }))
  }, [])

  const setBotId = useCallback((botId: string | undefined) => {
    setFilters(prev => ({ ...prev, botId }))
  }, [])

  const loadMore = useCallback(() => {
    if (hasMore && !query.isFetchingNextPage) {
      query.fetchNextPage()
    }
  }, [hasMore, query])

  return {
    conversations,
    total,
    hasMore,
    filters,
    isLoading: query.isLoading,
    isLoadingMore: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    setStatus,
    setBotId,
    loadMore,
  }
}

// =============================================================================
// Detail Hook
// =============================================================================

export function useConversation(id: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: conversationKeys.detail(id || ''),
    queryFn: () => conversationService.getConversation(id!),
    enabled: !!id,
  })

  // Derived state
  const conversation = query.data?.conversation || null
  const messages = query.data?.messages || []
  const variables = query.data?.variables || {}

  // Mutations
  const takeoverMutation = useMutation({
    mutationFn: (agentName?: string) =>
      conversationService.takeoverConversation(id!, agentName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(id!) })
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
    },
  })

  const releaseMutation = useMutation({
    mutationFn: () => conversationService.releaseConversation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(id!) })
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
    },
  })

  const sendMessageMutation = useMutation({
    mutationFn: (text: string) => conversationService.sendMessage(id!, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(id!) })
    },
  })

  const endMutation = useMutation({
    mutationFn: () => conversationService.endConversation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(id!) })
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
    },
  })

  return {
    conversation,
    messages,
    variables,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    // Actions
    takeover: takeoverMutation.mutateAsync,
    isTakingOver: takeoverMutation.isPending,
    release: releaseMutation.mutateAsync,
    isReleasing: releaseMutation.isPending,
    sendMessage: sendMessageMutation.mutateAsync,
    isSending: sendMessageMutation.isPending,
    end: endMutation.mutateAsync,
    isEnding: endMutation.isPending,
  }
}

// =============================================================================
// Variables Hook
// =============================================================================

export function useConversationVariables(conversationId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: conversationKeys.variables(conversationId || ''),
    queryFn: () => conversationService.getConversationVariables(conversationId!),
    enabled: !!conversationId,
  })

  const updateMutation = useMutation({
    mutationFn: ({
      variables,
      deleteKeys
    }: {
      variables: Record<string, string>
      deleteKeys?: string[]
    }) => conversationService.updateConversationVariables(conversationId!, variables, deleteKeys),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.variables(conversationId!) })
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId!) })
    },
  })

  return {
    variables: query.data?.variables || {},
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    updateVariables: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  }
}

// =============================================================================
// Controller Hook (Combined)
// =============================================================================

export function useConversationsController() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'active' | 'paused' | 'ended' | undefined>(undefined)

  const listHook = useConversations({ status: statusFilter })
  const detailHook = useConversation(selectedId)

  return {
    // List
    conversations: listHook.conversations,
    total: listHook.total,
    hasMore: listHook.hasMore,
    isListLoading: listHook.isLoading,
    isLoadingMore: listHook.isLoadingMore,
    loadMore: listHook.loadMore,
    // Selection
    selectedId,
    setSelectedId,
    selectedConversation: detailHook.conversation,
    selectedMessages: detailHook.messages,
    selectedVariables: detailHook.variables,
    isDetailLoading: detailHook.isLoading,
    // Filters
    statusFilter,
    setStatusFilter,
    // Actions
    takeover: detailHook.takeover,
    release: detailHook.release,
    sendMessage: detailHook.sendMessage,
    endConversation: detailHook.end,
    // Loading states
    isTakingOver: detailHook.isTakingOver,
    isReleasing: detailHook.isReleasing,
    isSending: detailHook.isSending,
    isEnding: detailHook.isEnding,
    // Refresh
    refetchList: listHook.refetch,
    refetchDetail: detailHook.refetch,
  }
}
