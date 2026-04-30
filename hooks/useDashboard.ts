import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import { useRealtimeQuery } from './useRealtimeQuery';
import { useCurrentUser } from './useCurrentUser';

// Polling interval: 30 seconds (fallback when Realtime unavailable)
const POLLING_INTERVAL = 30000;

export const useDashboardController = (initialData?: { stats: any, recentCampaigns: any[] }) => {
  const { activeOrgId } = useCurrentUser()
  const orgFilter = activeOrgId && activeOrgId !== '*'
    ? `organization_id=eq.${activeOrgId}`
    : undefined

  // Stats with Realtime updates - subscribes to campaigns table for live metrics
  const statsQuery = useRealtimeQuery({
    queryKey: ['dashboardStats', activeOrgId],
    queryFn: dashboardService.getStats,
    placeholderData: initialData?.stats,
    refetchInterval: POLLING_INTERVAL,
    staleTime: 15000,
    gcTime: 60000,
    refetchOnMount: true,
    refetchOnWindowFocus: 'always',
    // Realtime configuration
    table: 'campaigns',
    events: ['INSERT', 'UPDATE'],
    debounceMs: 500, // Dashboard can be slower
    filter: orgFilter,
  });

  // Recent campaigns with Realtime updates
  const recentCampaignsQuery = useRealtimeQuery({
    queryKey: ['recentCampaigns', activeOrgId],
    queryFn: dashboardService.getRecentCampaigns,
    placeholderData: initialData?.recentCampaigns,
    refetchInterval: POLLING_INTERVAL,
    staleTime: 20000,
    gcTime: 120000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    // Realtime configuration
    table: 'campaigns',
    events: ['INSERT', 'UPDATE', 'DELETE'],
    debounceMs: 500,
    filter: orgFilter,
  });

  return {
    stats: statsQuery.data,
    recentCampaigns: recentCampaignsQuery.data,
    isLoading: statsQuery.isLoading && !statsQuery.data,
    isFetching: statsQuery.isFetching || recentCampaignsQuery.isFetching,
    isError: statsQuery.isError || recentCampaignsQuery.isError,
    refetch: () => {
      statsQuery.refetch();
      recentCampaignsQuery.refetch();
    }
  };
};

