import React from 'react';
import { PrefetchLink } from '@/components/ui/PrefetchLink';
import { Send, TrendingUp, AlertCircle, CheckCircle2, MoreHorizontal, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Campaign, CampaignStatus } from '../../../types';
import { DashboardStats } from '../../../services/dashboardService';

interface DashboardViewProps {
  stats: DashboardStats;
  recentCampaigns: Campaign[];
  isLoading: boolean;
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: string;
  trendUp?: boolean;
  color: string;
}

const StatCard = ({ title, value, icon: Icon, trend, trendUp, color }: StatCardProps) => {
  // Map color prop to actual Tailwind classes
  const colorStyles: Record<string, { bg: string; text: string }> = {
    'bg-blue-500': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    'bg-emerald-500': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    'bg-purple-500': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    'bg-red-500': { bg: 'bg-red-500/20', text: 'text-red-400' },
  };
  
  const styles = colorStyles[color] || { bg: 'bg-zinc-500/20', text: 'text-zinc-400' };
  
  return (
    <div className="glass-panel p-6 rounded-2xl hover:bg-white/5 transition-colors group">
      <div className="flex items-start justify-between mb-6">
        <div className={`p-3 rounded-xl ${styles.bg} border border-white/5 group-hover:scale-105 transition-transform duration-300`}>
          <Icon size={20} className={styles.text} />
        </div>
        {trend ? (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${trendUp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend}
          </div>
        ) : (
          <div className="text-xs text-gray-600 px-2 py-1">—</div>
        )}
      </div>
      <div>
        <h3 className="text-3xl font-bold text-white mb-1 tracking-tight">{value}</h3>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: CampaignStatus }) => {
  const styles = {
    [CampaignStatus.COMPLETED]: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    [CampaignStatus.SENDING]: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    [CampaignStatus.FAILED]: 'bg-red-500/10 text-red-400 border-red-500/20',
    [CampaignStatus.DRAFT]: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    [CampaignStatus.PAUSED]: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    [CampaignStatus.SCHEDULED]: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  const labels = {
    [CampaignStatus.COMPLETED]: 'Concluído',
    [CampaignStatus.SENDING]: 'Enviando',
    [CampaignStatus.FAILED]: 'Falhou',
    [CampaignStatus.DRAFT]: 'Rascunho',
    [CampaignStatus.PAUSED]: 'Pausado',
    [CampaignStatus.SCHEDULED]: 'Agendado',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({ stats, recentCampaigns, isLoading }) => {
  // Skeleton loader for stats cards
  const StatSkeleton = () => (
    <div className="glass-panel p-6 rounded-2xl animate-pulse">
      <div className="flex items-start justify-between mb-6">
        <div className="w-12 h-12 rounded-xl bg-zinc-700/50" />
        <div className="w-16 h-6 rounded-full bg-zinc-700/50" />
      </div>
      <div>
        <div className="w-20 h-9 bg-zinc-700/50 rounded mb-2" />
        <div className="w-28 h-4 bg-zinc-700/50 rounded" />
      </div>
    </div>
  );

  // Skeleton loader for campaign rows
  const CampaignSkeleton = () => (
    <div className="flex items-center justify-between py-4 px-4 animate-pulse">
      <div className="flex-1">
        <div className="w-40 h-5 bg-zinc-700/50 rounded mb-2" />
        <div className="w-24 h-3 bg-zinc-700/50 rounded" />
      </div>
      <div className="w-20 h-6 bg-zinc-700/50 rounded-full" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Dashboard</h1>
          <p className="text-gray-400">Visão geral da performance de mensagens</p>
        </div>
        <PrefetchLink 
          href="/campaigns/new"
          className="bg-white text-black hover:bg-gray-200 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-white/5"
        >
          Campanha Rápida
        </PrefetchLink>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard 
              title="Total Enviado" 
              value={stats.sent24h} 
              icon={Send} 
              color="bg-blue-500"
            />
            <StatCard 
              title="Taxa de Entrega" 
              value={stats.deliveryRate} 
              icon={CheckCircle2} 
              color="bg-emerald-500"
            />
            <StatCard 
              title="Campanhas Ativas" 
              value={stats.activeCampaigns} 
              icon={TrendingUp} 
              color="bg-purple-500"
            />
            <StatCard 
              title="Falhas no Envio" 
              value={stats.failedMessages} 
              icon={AlertCircle} 
              color="bg-red-500"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 glass-panel p-8 rounded-2xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-semibold text-white" id="chart-title">Volume de Mensagens</h3>
            <div className="flex gap-2" role="group" aria-label="Período do gráfico">
              {[
                { key: '1H', label: 'Última hora' },
                { key: '24H', label: 'Últimas 24 horas' },
                { key: '7D', label: 'Últimos 7 dias' },
                { key: '30D', label: 'Últimos 30 dias' }
              ].map((t) => (
                <button 
                  key={t.key} 
                  aria-label={t.label}
                  aria-pressed={t.key === '7D'}
                  className={`text-xs px-3 py-1 rounded-lg transition-colors ${t.key === '7D' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {t.key}
                </button>
              ))}
            </div>
          </div>
          <figure 
            role="figure" 
            aria-labelledby="chart-title"
            aria-describedby="chart-description"
          >
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData} aria-hidden="true">
                  <defs>
                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#71717a', fontSize: 12}} 
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#71717a', fontSize: 12}} 
                />
                <Tooltip 
                  contentStyle={{backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a', color: '#fff'}}
                  itemStyle={{color: '#10b981'}}
                  labelStyle={{color: '#gray'}}
                  formatter={(value: number) => [value, 'Enviadas']}
                />
                <Area 
                  type="monotone" 
                  dataKey="sent" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSent)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p id="chart-description" className="sr-only">
            Gráfico de área mostrando o volume de mensagens enviadas ao longo do tempo. 
            Os dados são atualizados automaticamente.
          </p>
        </figure>
        </div>

        {/* Recent Activity */}
        <div className="glass-panel rounded-2xl flex flex-col">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Campanhas Recentes</h3>
            <button 
              aria-label="Mais opções"
              className="text-gray-500 hover:text-white"
            >
              <MoreHorizontal size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {recentCampaigns.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Nenhuma campanha ainda.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Campanha</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentCampaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-white/5 transition-colors group cursor-pointer">
                      <td className="px-6 py-5">
                        <p className="font-medium text-white group-hover:text-primary-400 transition-colors">{campaign.name}</p>
                        <p className="text-gray-500 text-xs mt-1 font-mono">{new Date(campaign.createdAt).toLocaleDateString('pt-BR')}</p>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <StatusBadge status={campaign.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="p-4 border-t border-white/5 text-center">
            <PrefetchLink href="/campaigns" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2">
              Ver Todas <ArrowUpRight size={14} />
            </PrefetchLink>
          </div>
        </div>
      </div>
    </div>
  );
};
