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
  const colorStyles: Record<string, { bg: string; text: string; glow: string; bar: string }> = {
    'bg-blue-500':    { bg: 'bg-blue-500/10',    text: 'text-blue-400',    glow: 'shadow-blue-500/10',    bar: 'bg-blue-500' },
    'bg-purple-500':  { bg: 'bg-purple-500/10',   text: 'text-purple-400',  glow: 'shadow-purple-500/10',  bar: 'bg-purple-500' },
    'bg-red-500':     { bg: 'bg-red-500/10',      text: 'text-red-400',     glow: 'shadow-red-500/10',     bar: 'bg-red-500' },
  };

  const styles = colorStyles[color] || { bg: 'bg-zinc-500/10', text: 'text-zinc-400', glow: '', bar: 'bg-zinc-500' };

  return (
    <div className={`relative glass-panel p-5 rounded-2xl hover:bg-white/5 transition-all duration-300 group overflow-hidden shadow-lg ${styles.glow}`}>
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-px ${styles.bar} opacity-30`} />

      <div className="flex items-start justify-between mb-5">
        <div className={`p-2.5 rounded-xl ${styles.bg} border border-white/5 group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={18} className={styles.text} />
        </div>
        {trend ? (
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border ${trendUp ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
            {trendUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {trend}
          </div>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 mt-1.5" />
        )}
      </div>
      <div>
        <h3 className="text-2xl font-bold text-white tracking-tight leading-none mb-1.5">{value}</h3>
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">{title}</p>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: CampaignStatus }) => {
  const styles = {
    [CampaignStatus.COMPLETED]: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight leading-none mb-1">Dashboard</h1>
          <p className="text-sm text-zinc-500">Visão geral da performance de mensagens</p>
        </div>
        <PrefetchLink
          href="/campaigns/new"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-xl font-medium text-sm transition-all shadow-lg shadow-primary-900/30 blue-glow"
        >
          <Send size={14} />
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
              color="bg-blue-500"
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
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-zinc-200" id="chart-title">Volume de Mensagens</h3>
            <div className="flex gap-1 p-0.5 bg-zinc-800/80 rounded-lg border border-zinc-700/50" role="group" aria-label="Período do gráfico">
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
                  className={`text-[11px] px-2.5 py-1 rounded-md transition-all ${t.key === '7D' ? 'bg-zinc-700 text-white font-medium shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
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
          <div className="p-5 border-b border-white/5 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-zinc-200">Campanhas Recentes</h3>
            <button
              aria-label="Mais opções"
              className="text-zinc-600 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition-all"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
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
