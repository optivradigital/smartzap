import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { campaignService } from '../services';
import { Campaign, CampaignStatus } from '../types';
import { useRealtimeQuery } from './useRealtimeQuery';
import { useCurrentUser } from './useCurrentUser';

// --- Data Hook (React Query + Realtime) ---
export const useCampaignsQuery = (initialData?: Campaign[]) => {
  const { activeOrgId } = useCurrentUser()
  return useRealtimeQuery({
    queryKey: ['campaigns', activeOrgId ?? 'default'],
    queryFn: campaignService.getAll,
    initialData: initialData,
    staleTime: 15 * 1000,  // 15 segundos
    // Realtime configuration
    table: 'campaigns',
    events: ['INSERT', 'UPDATE', 'DELETE'],
    debounceMs: 200,
  });
};

// --- Mutations ---
export const useCampaignMutations = () => {
  const queryClient = useQueryClient();

  // Track which IDs are currently being processed
  const [processingDuplicateId, setProcessingDuplicateId] = useState<string | undefined>(undefined);
  const [processingDeleteId, setProcessingDeleteId] = useState<string | undefined>(undefined);

  const deleteMutation = useMutation({
    mutationFn: campaignService.delete,
    // Optimistic update: remove immediately from UI
    onMutate: async (id: string) => {
      setProcessingDeleteId(id);
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['campaigns'] });

      // Get the current data
      const previousData = queryClient.getQueryData<Campaign[]>(['campaigns']);

      // Optimistically remove from cache
      queryClient.setQueryData<Campaign[]>(['campaigns'], (old) =>
        old?.filter(c => c.id !== id) ?? []
      );

      // Also remove from dashboard recent campaigns
      queryClient.setQueryData<Campaign[]>(['recentCampaigns'], (old) =>
        old?.filter(c => c.id !== id) ?? []
      );

      return { previousData };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['campaigns'], context.previousData);
      }
    },
    onSuccess: () => {
      // Server-side cache was invalidated via revalidateTag
      // Force refetch to get fresh data from invalidated cache
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['recentCampaigns'] });
    },
    onSettled: () => {
      setProcessingDeleteId(undefined);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      setProcessingDuplicateId(id);
      const result = await campaignService.duplicate(id);
      return result;
    },
    onSuccess: (newCampaign) => {
      // Add the new campaign to cache
      queryClient.setQueryData<Campaign[]>(['campaigns'], (old) => {
        if (!old) return [newCampaign];
        return [newCampaign, ...old];
      });
    },
    onSettled: () => {
      setProcessingDuplicateId(undefined);
    },
  });

  return {
    deleteCampaign: deleteMutation.mutate,
    duplicateCampaign: duplicateMutation.mutate,
    isDeleting: deleteMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
    deletingId: processingDeleteId,
    duplicatingId: processingDuplicateId,
  };
};

// --- Controller Hook (Smart) ---
export const useCampaignsController = (initialData?: Campaign[]) => {
  const { data: campaigns = [], isLoading, error, refetch } = useCampaignsQuery(initialData);
  const { deleteCampaign, duplicateCampaign, isDeleting, isDuplicating, deletingId, duplicatingId } = useCampaignMutations();

  // UI State
  const [filter, setFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Business Logic: Filtering
  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];

    return campaigns.filter(c => {
      const matchesFilter = filter === 'All' || c.status === filter;
      const matchesSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.templateName || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [campaigns, filter, searchTerm]);

  // Handlers
  const handleDelete = (id: string) => {
    // Deletar diretamente sem confirmação (pode ser desfeito clonando)
    deleteCampaign(id);
  };

  const handleDuplicate = (id: string) => {
    duplicateCampaign(id);
  };

  const handleRefresh = () => {
    refetch();
  };

  return {
    // Data
    campaigns: filteredCampaigns,
    isLoading,
    error,

    // State
    filter,
    searchTerm,

    // Setters
    setFilter,
    setSearchTerm,

    // Actions
    onDelete: handleDelete,
    onDuplicate: handleDuplicate,
    onRefresh: handleRefresh,

    // Loading states for specific items
    isDeleting,
    isDuplicating,
    deletingId,
    duplicatingId,
  };
};
