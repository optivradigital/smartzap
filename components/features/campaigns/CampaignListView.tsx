import React from 'react';
import { Search, RefreshCw, Copy, Trash2, Calendar, Play, Pause, Loader2 } from 'lucide-react';
import { Campaign, CampaignStatus } from '../../../types';
import { CampaignStatusBadge } from '../../ui/CampaignStatusBadge';

interface CampaignListViewProps {
  campaigns: Campaign[];
  isLoading: boolean;
  filter: string;
  searchTerm: string;
  onFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRowClick: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onStart?: (id: string) => void;
  isPausing?: boolean;
  isResuming?: boolean;
  isStarting?: boolean;
  deletingId?: string;
  duplicatingId?: string;
}


export const CampaignListView: React.FC<CampaignListViewProps> = ({
  campaigns,
  isLoading,
  filter,
  searchTerm,
  onFilterChange,
  onSearchChange,
  onRefresh,
  onDelete,
  onDuplicate,
  onRowClick,
  onPause,
  onResume,
  onStart,
  isPausing,
  isResuming,
  isStarting,
  deletingId,
  duplicatingId,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-zinc-800/80 rounded-lg animate-pulse" />
        <div className="glass-panel p-4 rounded-xl h-14 animate-pulse" />
        <div className="glass-panel rounded-xl overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-6 px-6 py-4 border-b border-white/5">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-zinc-800/80 rounded animate-pulse" />
                <div className="h-3 w-32 bg-zinc-800/50 rounded animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-zinc-800/80 rounded-full animate-pulse" />
              <div className="h-4 w-16 bg-zinc-800/50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none mb-1">Campanhas</h1>
          <p className="text-sm text-muted-foreground">Gerencie e acompanhe seus disparos de mensagens</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2.5 flex-1 sm:max-w-sm bg-muted dark:bg-zinc-900 border border-border dark:border-zinc-800 rounded-xl px-3.5 py-2.5 focus-within:border-primary-500/50 focus-within:ring-1 focus-within:ring-primary-500/20 transition-all">
          <Search size={15} className="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Buscar campanhas..."
            className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="px-3 py-2.5 text-xs font-medium bg-muted dark:bg-zinc-900 text-foreground rounded-xl border border-border dark:border-zinc-800 outline-none cursor-pointer transition-colors hover:border-primary-500/50"
          >
            <option value="All">Todos os Status</option>
            <option value={CampaignStatus.DRAFT}>Rascunho</option>
            <option value={CampaignStatus.SENDING}>Enviando</option>
            <option value={CampaignStatus.COMPLETED}>Concluído</option>
            <option value={CampaignStatus.PAUSED}>Pausado</option>
            <option value={CampaignStatus.SCHEDULED}>Agendado</option>
            <option value={CampaignStatus.FAILED}>Falhou</option>
          </select>
          <button
            onClick={onRefresh}
            className="p-2.5 text-muted-foreground hover:text-foreground bg-muted dark:bg-zinc-900 hover:bg-accent rounded-xl border border-border dark:border-zinc-800 transition-all"
            title="Atualizar"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/5">
              <tr>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Nome</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Status</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Destinatários</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Entrega</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Criado em</th>
                <th className="px-5 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-1">
                        <Search size={18} className="text-muted-foreground" />
                      </div>
                      <p className="text-sm text-foreground font-medium">Nenhuma campanha encontrada</p>
                      <p className="text-xs text-muted-foreground">Tente ajustar os filtros ou crie uma nova campanha</p>
                    </div>
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    onClick={() => onRowClick(campaign.id)}
                    className="hover:bg-zinc-800/30 transition-all duration-150 group cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary-400 transition-colors leading-none mb-1">{campaign.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{campaign.templateName}</p>
                      {campaign.scheduledAt && campaign.status === CampaignStatus.SCHEDULED && (
                        <p className="text-[11px] text-purple-400 mt-1 flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(campaign.scheduledAt).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <CampaignStatusBadge status={campaign.status} />
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">
                      {(campaign.recipients ?? 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 max-w-[80px] bg-zinc-800 rounded-full h-1">
                          <div
                            className="bg-primary-500 h-1 rounded-full"
                            style={{ width: `${(campaign.recipients ?? 0) > 0 ? ((campaign.delivered ?? 0) / (campaign.recipients ?? 1)) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
                          {(campaign.recipients ?? 0) > 0 ? Math.round(((campaign.delivered ?? 0) / (campaign.recipients ?? 1)) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs tabular-nums">
                      {new Date(campaign.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Quick action: Start scheduled campaign */}
                        {(campaign.status === CampaignStatus.SCHEDULED || campaign.status === CampaignStatus.DRAFT) && onStart && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onStart(campaign.id); }}
                            title="Iniciar agora"
                            disabled={isStarting}
                            className="p-2 rounded-lg text-gray-400 hover:text-primary-400 hover:bg-primary-500/10 disabled:opacity-50"
                          >
                            <Play size={16} />
                          </button>
                        )}

                        {/* Quick action: Pause sending campaign */}
                        {campaign.status === CampaignStatus.SENDING && onPause && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onPause(campaign.id); }}
                            title="Pausar"
                            disabled={isPausing}
                            className="p-2 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                          >
                            <Pause size={16} />
                          </button>
                        )}

                        {/* Quick action: Resume paused campaign */}
                        {campaign.status === CampaignStatus.PAUSED && onResume && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onResume(campaign.id); }}
                            title="Retomar"
                            disabled={isResuming}
                            className="p-2 rounded-lg text-gray-400 hover:text-primary-400 hover:bg-primary-500/10 disabled:opacity-50"
                          >
                            <Play size={16} />
                          </button>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); onDuplicate(campaign.id); }}
                          title="Duplicar"
                          disabled={duplicatingId === campaign.id}
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {duplicatingId === campaign.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(campaign.id); }}
                          title="Excluir"
                          disabled={deletingId === campaign.id}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === campaign.id ? (
                            <Loader2 size={16} className="animate-spin text-red-400" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
