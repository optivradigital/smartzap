import { Campaign } from '../types';

export interface ChartDataPoint {
  name: string;
  sent: number;
  read: number;
}

export interface DashboardStats {
  sent24h: string;
  deliveryRate: string;
  activeCampaigns: string;
  failedMessages: string;
  chartData: ChartDataPoint[];
}

// API response from /api/dashboard/stats
interface StatsAPIResponse {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  activeCampaigns: number;
  deliveryRate: number;
}

function periodCutoff(period: string): Date | null {
  const now = new Date();
  if (period === '1H')  return new Date(now.getTime() - 1 * 60 * 60 * 1000);
  if (period === '24H') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (period === '7D')  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === '30D') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null;
}

export const dashboardService = {
  /**
   * Buscar stats do dashboard direto da API otimizada.
   * A API faz uma única query SQL agregada no servidor.
   * Cache: 15s no edge, stale-while-revalidate: 30s
   */
  getStats: async (period: string = '7D'): Promise<DashboardStats> => {
    // Fazer ambas chamadas em PARALELO
    const [statsResponse, campaignsResponse] = await Promise.all([
      fetch('/api/dashboard/stats'),
      fetch('/api/campaigns')
    ]);

    // Parse das respostas
    const stats: StatsAPIResponse = statsResponse.ok
      ? await statsResponse.json()
      : { totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0, activeCampaigns: 0, deliveryRate: 0 };

    const allCampaigns: Campaign[] = campaignsResponse.ok
      ? await campaignsResponse.json()
      : [];

    // Filtrar campanhas pelo período selecionado
    const cutoff = periodCutoff(period);
    const campaigns = cutoff
      ? allCampaigns.filter(c => c.createdAt && new Date(c.createdAt) >= cutoff)
      : allCampaigns;

    // Chart data: usar índice numérico (1, 2, 3...) no eixo X
    const chartData = campaigns.slice(0, 7).map((c, i) => ({
      name: String(i + 1),
      sent: c.recipients || 0,
      read: c.read || 0
    })).reverse();

    return {
      sent24h: stats.totalSent.toLocaleString(),
      deliveryRate: `${stats.deliveryRate}%`,
      activeCampaigns: stats.activeCampaigns.toString(),
      failedMessages: stats.totalFailed.toString(),
      chartData
    };
  },

  /**
   * Buscar campanhas recentes (top 5).
   * Usa o cache do /api/campaigns (10s edge cache)
   */
  getRecentCampaigns: async (): Promise<Campaign[]> => {
    try {
      const response = await fetch('/api/campaigns');
      if (!response.ok) return [];
      const campaigns: Campaign[] = await response.json();
      return campaigns.slice(0, 5);
    } catch {
      return [];
    }
  }
};
