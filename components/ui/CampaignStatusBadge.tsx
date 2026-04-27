import { CampaignStatus } from '../../types'

const styles: Record<CampaignStatus, string> = {
  [CampaignStatus.COMPLETED]: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  [CampaignStatus.SENDING]:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  [CampaignStatus.FAILED]:    'bg-red-500/10 text-red-400 border-red-500/20',
  [CampaignStatus.DRAFT]:     'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  [CampaignStatus.PAUSED]:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  [CampaignStatus.SCHEDULED]: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

const labels: Record<CampaignStatus, string> = {
  [CampaignStatus.COMPLETED]: 'Concluído',
  [CampaignStatus.SENDING]:   'Enviando',
  [CampaignStatus.FAILED]:    'Falhou',
  [CampaignStatus.DRAFT]:     'Rascunho',
  [CampaignStatus.PAUSED]:    'Pausado',
  [CampaignStatus.SCHEDULED]: 'Agendado',
}

export const CampaignStatusBadge = ({ status }: { status: CampaignStatus }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${styles[status]}`}>
    {status === CampaignStatus.SENDING && (
      <span className="relative flex h-2 w-2 mr-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
      </span>
    )}
    {labels[status]}
  </span>
)
