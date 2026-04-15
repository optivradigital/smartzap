import React from 'react';
import { PrefetchLink } from '@/components/ui/PrefetchLink';
import { ChevronLeft, Clock, CheckCircle2, Eye, AlertCircle, Download, Search, Filter, RefreshCw, Pause, Play, Calendar, Loader2, PhoneOff } from 'lucide-react';
import { Campaign, CampaignStatus, Message, MessageStatus } from '../../../types';

interface DetailCardProps {
  title: string;
  value: string;
  subvalue: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
}

const DetailCard = ({ title, value, subvalue, icon: Icon, color }: DetailCardProps) => (
  <div className="glass-panel p-6 rounded-2xl border-l-4" style={{ borderLeftColor: color }}>
    <div className="flex justify-between items-start mb-2">
      <div>
        <p className="text-sm text-gray-400 font-medium">{title}</p>
        <h3 className="text-3xl font-bold text-white mt-1">{value}</h3>
      </div>
      <div className={`p-2 rounded-lg bg-white/5 text-white`}>
        <Icon size={20} color={color} />
      </div>
    </div>
    <p className="text-xs text-gray-500">{subvalue}</p>
  </div>
);

const MessageStatusBadge = ({ status }: { status: MessageStatus }) => {
  const styles: Record<string, string> = {
    [MessageStatus.PENDING]: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    [MessageStatus.READ]: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    [MessageStatus.DELIVERED]: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    [MessageStatus.SENT]: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
    [MessageStatus.FAILED]: 'text-red-400 bg-red-500/10 border-red-500/20',
    [MessageStatus.NOT_EXISTS]: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    [MessageStatus.INVALID]: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    // Fallback para valores antigos em inglês
    'Pending': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    'Read': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    'Delivered': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    'Sent': 'text-gray-400 bg-gray-500/10 border-gray-500/20',
    'Failed': 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  const icons: Record<string, React.ReactNode> = {
    [MessageStatus.PENDING]: <Loader2 size={12} className="mr-1 animate-spin" />,
    [MessageStatus.READ]: <Eye size={12} className="mr-1" />,
    [MessageStatus.DELIVERED]: <CheckCircle2 size={12} className="mr-1" />,
    [MessageStatus.SENT]: <Clock size={12} className="mr-1" />,
    [MessageStatus.FAILED]: <AlertCircle size={12} className="mr-1" />,
    [MessageStatus.NOT_EXISTS]: <PhoneOff size={12} className="mr-1" />,
    [MessageStatus.INVALID]: <PhoneOff size={12} className="mr-1" />,
    // Fallback para valores antigos em inglês
    'Pending': <Loader2 size={12} className="mr-1 animate-spin" />,
    'Read': <Eye size={12} className="mr-1" />,
    'Delivered': <CheckCircle2 size={12} className="mr-1" />,
    'Sent': <Clock size={12} className="mr-1" />,
    'Failed': <AlertCircle size={12} className="mr-1" />,
  };

  // Mapa de tradução para garantir exibição em PT-BR
  const labels: Record<string, string> = {
    [MessageStatus.PENDING]: 'Pendente',
    [MessageStatus.READ]: 'Lido',
    [MessageStatus.DELIVERED]: 'Entregue',
    [MessageStatus.SENT]: 'Enviado',
    [MessageStatus.FAILED]: 'Falhou',
    [MessageStatus.NOT_EXISTS]: 'Não existe',
    // Fallback para valores antigos em inglês
    'Pending': 'Pendente',
    'Read': 'Lido',
    'Delivered': 'Entregue',
    'Sent': 'Enviado',
    'Failed': 'Falhou',
  };

  const style = styles[status] || 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  const icon = icons[status] || <Clock size={12} className="mr-1" />;
  const label = labels[status] || status;

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${style}`}>
      {icon} {label}
    </span>
  );
};

// Navigate function type compatible with Next.js
type NavigateFn = (path: string, options?: { replace?: boolean }) => void;

interface MessageStats {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  invalid: number;
}

interface CampaignDetailsViewProps {
  campaign?: Campaign;
  messages: Message[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  navigate: NavigateFn;
  messageStats?: MessageStats;
  // Actions
  onPause?: () => void;
  onResume?: () => void;
  onStart?: () => void;
  isPausing?: boolean;
  isResuming?: boolean;
  isStarting?: boolean;
  canPause?: boolean;
  canResume?: boolean;
  canStart?: boolean;
  // Realtime status
  isRealtimeConnected?: boolean;
  shouldShowRefreshButton?: boolean;
  isRefreshing?: boolean;
  refetch?: () => void;
  onExportCsv?: () => void;
}

export const CampaignDetailsView: React.FC<CampaignDetailsViewProps> = ({
  campaign,
  messages,
  isLoading,
  searchTerm,
  setSearchTerm,
  navigate,
  messageStats,
  onPause,
  onResume,
  onStart,
  isPausing,
  isResuming,
  isStarting,
  canPause,
  canResume,
  canStart,
  isRealtimeConnected,
  shouldShowRefreshButton,
  isRefreshing,
  refetch,
  onExportCsv,
}) => {
  if (isLoading || !campaign) return <div className="p-10 text-center text-gray-500">Carregando...</div>;

  // Falhas: soma failed + invalid (números sem WhatsApp) das stats reais
  const failedCount = messageStats ? (messageStats.failed + messageStats.invalid) : (campaign.failed ?? 0);
  const failedSubvalue = (() => {
    if (!messageStats) return 'Números inválidos ou bloqueio';
    const { failed, invalid } = messageStats;
    if (failed > 0 && invalid > 0) return `${invalid} sem WhatsApp · ${failed} bloqueio/erro`;
    if (invalid > 0) return `${invalid} número${invalid > 1 ? 's' : ''} sem WhatsApp ativo`;
    if (failed > 0) return `${failed} bloqueio${failed > 1 ? 's' : ''} ou erro de envio`;
    return 'Nenhuma falha';
  })();

  // Format scheduled time for display
  const scheduledTimeDisplay = campaign.scheduledAt
    ? new Date(campaign.scheduledAt).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
    : null;

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <PrefetchLink href="/campaigns" className="text-xs text-gray-500 hover:text-white mb-2 inline-flex items-center gap-1 transition-colors">
            <ChevronLeft size={12} /> Voltar para Lista
          </PrefetchLink>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            {campaign.name}
            <span className={`text-xs px-2 py-1 rounded border ${campaign.status === CampaignStatus.COMPLETED ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              campaign.status === CampaignStatus.SENDING ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                campaign.status === CampaignStatus.PAUSED ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                  campaign.status === CampaignStatus.SCHEDULED ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                    campaign.status === CampaignStatus.FAILED ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      'bg-zinc-800 border-zinc-700 text-gray-400'
              }`}>
              {campaign.status}
            </span>
            {isRealtimeConnected && (
              <span className="flex items-center gap-1 text-xs text-primary-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                </span>
                Ao vivo
              </span>
            )}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            ID: {campaign.id} • Criado em {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString('pt-BR') : 'agora'}
            {scheduledTimeDisplay && campaign.status === CampaignStatus.SCHEDULED && (
              <span className="ml-2 text-purple-400">
                <Calendar size={12} className="inline mr-1" />
                Agendado para {scheduledTimeDisplay}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Start button for scheduled campaigns */}
          {canStart && (
            <button
              onClick={onStart}
              disabled={isStarting}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 border border-primary-500/20 rounded-lg text-white transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
            >
              {isStarting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {isStarting ? 'Iniciando...' : 'Iniciar Agora'}
            </button>
          )}

          {/* Pause button for sending campaigns */}
          {canPause && (
            <button
              onClick={onPause}
              disabled={isPausing}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 border border-amber-500/20 rounded-lg text-white transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
            >
              {isPausing ? <Loader2 size={16} className="animate-spin" /> : <Pause size={16} />}
              {isPausing ? 'Pausando...' : 'Pausar'}
            </button>
          )}

          {/* Resume button for paused campaigns */}
          {canResume && (
            <button
              onClick={onResume}
              disabled={isResuming}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 border border-primary-500/20 rounded-lg text-white transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
            >
              {isResuming ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {isResuming ? 'Retomando...' : 'Retomar'}
            </button>
          )}

          {/* Refresh button - shown when realtime is disconnected for completed campaigns */}
          {shouldShowRefreshButton && (
            <button
              onClick={refetch}
              disabled={isRefreshing}
              className="px-4 py-2 bg-zinc-900 border border-white/10 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
            >
              {isRefreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {isRefreshing ? 'Atualizando...' : 'Atualizar'}
            </button>
          )}

          <button
            onClick={onExportCsv}
            className="px-4 py-2 bg-zinc-900 border border-white/10 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Download size={16} /> Relatório CSV
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DetailCard
          title="Enviadas"
          value={(campaign.sent ?? 0).toLocaleString()}
          subvalue={`${campaign.recipients ?? 0} destinatários`}
          icon={Clock}
          color="#a1a1aa"
        />
        <DetailCard
          title="Entregues"
          value={(campaign.delivered ?? 0).toLocaleString()}
          subvalue={(campaign.delivered ?? 0) > 0 ? `${(((campaign.delivered ?? 0) / (campaign.recipients ?? 1)) * 100).toFixed(1)}% taxa de entrega` : 'Aguardando webhook'}
          icon={CheckCircle2}
          color="#10b981"
        />
        <DetailCard
          title="Lidas"
          value={(campaign.read ?? 0).toLocaleString()}
          subvalue={(campaign.read ?? 0) > 0 ? `${(((campaign.read ?? 0) / (campaign.recipients ?? 1)) * 100).toFixed(1)}% taxa de abertura` : 'Aguardando webhook'}
          icon={Eye}
          color="#3b82f6"
        />
        <DetailCard
          title="Falhas"
          value={failedCount.toLocaleString()}
          subvalue={failedSubvalue}
          icon={AlertCircle}
          color="#ef4444"
        />
      </div>

      {/* Message Log */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-white flex items-center gap-2">
            Logs de Envio <span className="text-xs font-normal text-gray-500 bg-zinc-900 px-2 py-0.5 rounded-full">{messages.length}</span>
          </h3>

          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-1.5 w-full sm:w-64 focus-within:border-primary-500/50 transition-all">
              <Search size={14} className="text-gray-500" />
              <input
                type="text"
                placeholder="Buscar destinatário..."
                className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-600"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 transition-colors">
              <Filter size={16} />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 transition-colors">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-gray-400 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-3 font-medium">Destinatário</th>
                <th className="px-6 py-3 font-medium">Telefone</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Horário</th>
                <th className="px-6 py-3 font-medium">Info</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {messages.slice(0, 50).map((msg) => (
                <tr key={msg.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-3 font-medium text-gray-200">{msg.contactName}</td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-500">{msg.contactPhone}</td>
                  <td className="px-6 py-3">
                    <MessageStatusBadge status={msg.status} />
                  </td>
                  <td className="px-6 py-3 text-gray-500 text-xs">{msg.sentAt}</td>
                  <td className="px-6 py-3">
                    {msg.error ? (
                      <span className="text-red-400 text-xs flex items-center gap-1"><AlertCircle size={10} /> {msg.error}</span>
                    ) : (msg.status === MessageStatus.INVALID || msg.status === MessageStatus.NOT_EXISTS) ? (
                      <span className="text-orange-400 text-xs flex items-center gap-1"><AlertCircle size={10} /> Sem WhatsApp ativo</span>
                    ) : (
                      <span className="text-gray-600 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nenhum registro encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
          {messages.length > 50 && (
            <div className="p-3 text-center border-t border-white/5 text-xs text-gray-500">
              Mostrando os primeiros 50 resultados de {messages.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
