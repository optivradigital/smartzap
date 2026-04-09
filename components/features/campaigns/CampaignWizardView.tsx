import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Upload, Users, Smartphone, Check, MessageSquare, Eye, Zap, AlertCircle, Sparkles, RefreshCw, ShieldAlert, ExternalLink, TrendingUp, XCircle, CheckCircle, Circle, Clock, Calendar, FlaskConical, UserCheck, Search, X, FileSpreadsheet, FileUp } from 'lucide-react';
import { PrefetchLink } from '@/components/ui/PrefetchLink';
import { Template, Contact, TestContact } from '../../../types';
import { getPricingBreakdown } from '../../../lib/whatsapp-pricing';
import { useExchangeRate } from '../../../hooks/useExchangeRate';
import { WhatsAppPhonePreview } from '@/components/ui/WhatsAppPhonePreview';
import { AntiBanSettings, AntiBanConfig, DEFAULT_ANTI_BAN } from './AntiBanSettings';
import { CampaignValidation, AccountLimits, TIER_DISPLAY_NAMES, getNextTier, TIER_LIMITS, getUpgradeRoadmap, UpgradeStep } from '../../../lib/meta-limits';

// Helper Icon
const CheckCircleFilled = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.25 17.292l-4.5-4.364 1.857-1.858 2.643 2.506 5.643-5.784 1.857 1.857-7.5 7.643z" /></svg>
);

interface CampaignWizardViewProps {
  step: number;
  setStep: (step: number) => void;
  name: string;
  setName: (name: string) => void;
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  recipientSource: 'all' | 'specific' | 'test' | 'excel' | null;
  excelContacts: { name: string; phone: string }[];
  setExcelContacts: (contacts: { name: string; phone: string }[]) => void;
  setRecipientSource: (source: 'all' | 'specific' | 'test' | 'excel' | null) => void;
  totalContacts: number;
  recipientCount: number;
  allContacts: Contact[];
  selectedContacts: Contact[];
  selectedContactIds: string[];
  toggleContact: (contactId: string) => void;
  availableTemplates: Template[];
  selectedTemplate?: Template;
  handleNext: () => void;
  handleBack: () => void;
  handleSend: (scheduledAt?: string) => void;
  isCreating: boolean;
  isLoading: boolean;
  // Test Contact
  testContact?: TestContact;
  // Template Variables (for {{2}}, {{3}}, etc.)
  templateVariables?: string[];
  setTemplateVariables?: (vars: string[]) => void;
  templateVariableCount?: number;
  templateVariableInfo?: {
    body: { index: number; placeholder: string; context: string }[];
    header: { index: number; placeholder: string; context: string }[];
    buttons: { index: number; buttonIndex: number; buttonText: string; context: string }[];
    totalExtra: number;
  };
  // Account Limits & Validation
  accountLimits?: AccountLimits | null;
  isBlockModalOpen: boolean;
  setIsBlockModalOpen: (open: boolean) => void;
  blockReason: CampaignValidation | null;
  // Live validation
  liveValidation?: CampaignValidation | null;
  isOverLimit?: boolean;
  currentLimit?: number;
  // Anti-ban config
  antiBanConfig?: AntiBanConfig;
  setAntiBanConfig?: (config: AntiBanConfig) => void;
  providerType?: 'meta' | 'evolution';
  setProviderType?: (t: 'meta' | 'evolution') => void;
  // Multi-template (anti-ban rotation)
  additionalTemplateIds?: string[];
  setAdditionalTemplateIds?: (ids: string[]) => void;
  additionalTemplates?: Template[];
}


// ---------------------------------------------------------------------------
// ExcelUploader — parses CSV and XLSX files into { name, phone }[] contacts
// ---------------------------------------------------------------------------
interface ExcelUploaderProps {
  excelContacts: { name: string; phone: string }[];
  setExcelContacts: (contacts: { name: string; phone: string }[]) => void;
}

const ExcelUploader: React.FC<ExcelUploaderProps> = ({ excelContacts, setExcelContacts }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const normalizePhone = (raw: string): string => {
    let digits = raw.replace(/\D/g, '');
    if (digits.length <= 11 && !digits.startsWith('55')) {
      digits = '55' + digits;
    }
    return digits;
  };

  const processRows = (rows: Record<string, string>[]) => {
    setParseError(null);
    const results: { name: string; phone: string }[] = [];
    const phoneKeys = ['telefone', 'phone', 'celular', 'mobile', 'numero', 'número', 'tel', 'whatsapp'];
    const nameKeys = ['nome', 'name', 'contato', 'contact', 'cliente', 'client'];

    for (const row of rows) {
      const rawKeys = Object.keys(row);
      const phoneKey = rawKeys.find(k => phoneKeys.includes(k.toLowerCase().trim()));
      const nameKey = rawKeys.find(k => nameKeys.includes(k.toLowerCase().trim()));
      if (!phoneKey) continue;
      const rawPhone = String(row[phoneKey] || '').trim();
      const name = nameKey ? String(row[nameKey] || '').trim() : '';
      const phone = normalizePhone(rawPhone);
      if (phone.length >= 10) {
        results.push({ name: name || phone, phone });
      }
    }

    if (results.length === 0) {
      setParseError('Nenhum contato válido encontrado. Verifique se o arquivo tem colunas "nome" e "telefone" (ou variantes em inglês).');
    } else {
      setExcelContacts(results);
      // Persiste no Supabase (contacts table) em background — não bloqueia o fluxo
      fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: results }),
      })
        .then(r => r.json())
        .then(d => console.log(`[CSV] ${d.imported ?? 0} contatos sincronizados com Supabase`))
        .catch(e => console.warn('[CSV] Falha ao sincronizar contatos:', e));
    }
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      const text = await file.text();
      const Papa = (await import('papaparse')).default;
      const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      processRows(result.data);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
      processRows(rows);
    } else {
      setParseError('Formato não suportado. Use .xlsx, .xls ou .csv');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
      {excelContacts.length === 0 ? (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200 ${
            isDragging ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/20 hover:border-white/40 bg-zinc-900/50'
          }`}
        >
          <div className="p-3 rounded-full bg-emerald-500/20">
            <FileUp size={24} className="text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Arraste um arquivo aqui ou clique para selecionar</p>
            <p className="text-xs text-gray-500 mt-1">Suporta .xlsx, .xls e .csv</p>
          </div>
          <div className="bg-black/30 rounded-lg px-4 py-2 text-xs text-gray-400 text-center">
            O arquivo deve ter colunas <span className="text-white font-mono">nome</span> e <span className="text-white font-mono">telefone</span>
          </div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleChange} />
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-emerald-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-emerald-400" />
              <span className="text-sm font-medium text-white">{fileName}</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">{excelContacts.length} contatos</span>
            </div>
            <button
              onClick={() => { setExcelContacts([]); setFileName(null); }}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
            {excelContacts.slice(0, 50).map((c, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/50">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs text-emerald-400 font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 font-mono">+{c.phone}</p>
                </div>
              </div>
            ))}
            {excelContacts.length > 50 && (
              <p className="text-xs text-gray-500 text-center py-2">... e mais {excelContacts.length - 50} contatos</p>
            )}
          </div>
        </div>
      )}
      {parseError && (
        <div className="mt-3 flex items-start gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <p className="text-xs">{parseError}</p>
        </div>
      )}
    </div>
  );
};

// Modal de bloqueio quando campanha excede limites da conta
const CampaignBlockModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  validation: CampaignValidation | null;
  accountLimits?: AccountLimits | null;
}> = ({ isOpen, onClose, validation, accountLimits }) => {
  if (!isOpen || !validation) return null;

  const currentTier = accountLimits?.messagingTier || 'TIER_250';
  const nextTier = getNextTier(currentTier);
  const currentLimit = TIER_LIMITS[currentTier];
  const nextLimit = nextTier ? TIER_LIMITS[nextTier] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-4 p-6 border-b border-white/10 bg-red-500/5">
          <div className="p-3 bg-red-500/20 rounded-xl">
            <ShieldAlert className="text-red-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Limite de Envio Excedido</h2>
            <p className="text-sm text-gray-400">Sua conta não pode enviar essa quantidade</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <XCircle className="text-gray-400" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Status */}
          <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Seu Tier Atual</span>
              <span className="text-sm font-bold text-white bg-zinc-700 px-3 py-1 rounded-lg">
                {TIER_DISPLAY_NAMES[currentTier]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Limite de Mensagens/dia</span>
              <span className="text-sm font-bold text-primary-400">
                {currentLimit.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Você tentou enviar</span>
              <span className="text-sm font-bold text-red-400">
                {validation.requestedCount.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-sm text-gray-400">Excedente</span>
              <span className="text-sm font-bold text-red-400">
                +{(validation.requestedCount - currentLimit).toLocaleString('pt-BR')} mensagens
              </span>
            </div>
          </div>

          {/* Upgrade Roadmap */}
          {validation.upgradeRoadmap && validation.upgradeRoadmap.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <TrendingUp size={16} className="text-primary-400" />
                Como aumentar seu limite
              </div>
              <div className="space-y-2">
                {validation.upgradeRoadmap.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 bg-zinc-800/30 p-3 rounded-lg border border-white/5"
                  >
                    <div className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <p className="text-sm text-gray-300">{step.title}: {step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Tier Info */}
          {nextTier && nextLimit && (
            <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-primary-400" />
                <span className="text-sm font-bold text-primary-400">Próximo Tier: {TIER_DISPLAY_NAMES[nextTier]}</span>
              </div>
              <p className="text-sm text-gray-400">
                Com o tier {TIER_DISPLAY_NAMES[nextTier]}, você poderá enviar até{' '}
                <span className="text-white font-bold">{nextLimit.toLocaleString('pt-BR')}</span> mensagens por dia.
              </p>
            </div>
          )}

          {/* Suggestion */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
            <AlertCircle className="text-amber-400 flex-shrink-0" size={18} />
            <div className="text-sm text-amber-200/80">
              <p className="font-bold text-amber-400 mb-1">Sugestão</p>
              <p>
                Reduza o número de destinatários para no máximo{' '}
                <span className="font-bold text-white">{currentLimit.toLocaleString('pt-BR')}</span>{' '}
                ou divida sua campanha em múltiplos envios.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10 bg-zinc-800/30">
          <a
            href="https://developers.facebook.com/docs/whatsapp/messaging-limits"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-primary-400 flex items-center gap-1 transition-colors"
          >
            <ExternalLink size={14} />
            Documentação da Meta
          </a>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal de Upgrade - Mostra o roadmap para aumentar o tier
const UpgradeRoadmapModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  accountLimits?: AccountLimits | null;
}> = ({ isOpen, onClose, accountLimits }) => {
  if (!isOpen) return null;

  const currentTier = accountLimits?.messagingTier || 'TIER_250';
  const nextTier = getNextTier(currentTier);
  const currentLimit = TIER_LIMITS[currentTier];
  const nextLimit = nextTier ? TIER_LIMITS[nextTier] : null;

  // Get upgrade steps
  const upgradeSteps = accountLimits ? getUpgradeRoadmap(accountLimits) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg mx-4 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 p-6 border-b border-white/10 bg-gradient-to-r from-primary-500/10 to-transparent shrink-0">
          <div className="p-3 bg-primary-500/20 rounded-xl">
            <TrendingUp className="text-primary-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Aumentar seu Limite</h2>
            <p className="text-sm text-gray-400">Siga o roadmap para evoluir seu tier</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <XCircle className="text-gray-400" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Current vs Next Tier */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 rounded-xl p-4 text-center border border-white/5">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Tier Atual</p>
              <p className="text-lg font-bold text-white">{TIER_DISPLAY_NAMES[currentTier]}</p>
              <p className="text-sm text-gray-400">{currentLimit.toLocaleString('pt-BR')}/dia</p>
            </div>
            {nextTier && nextLimit && (
              <div className="bg-primary-500/10 rounded-xl p-4 text-center border border-primary-500/30">
                <p className="text-[10px] text-primary-400 uppercase tracking-wider mb-1">Próximo Tier</p>
                <p className="text-lg font-bold text-primary-400">{TIER_DISPLAY_NAMES[nextTier]}</p>
                <p className="text-sm text-primary-300">{nextLimit.toLocaleString('pt-BR')}/dia</p>
              </div>
            )}
          </div>

          {/* Upgrade Steps */}
          {upgradeSteps.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Passos para Evoluir</p>
              {upgradeSteps.map((step, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border transition-all ${step.completed
                    ? 'bg-primary-500/10 border-primary-500/30'
                    : 'bg-zinc-800/30 border-white/5'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${step.completed
                      ? 'bg-primary-500 text-white'
                      : 'bg-zinc-700 text-gray-400'
                      }`}>
                      {step.completed ? <Check size={14} /> : <Circle size={14} />}
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${step.completed ? 'text-primary-400' : 'text-white'}`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{step.description}</p>
                      {step.link && (
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 mt-2"
                        >
                          <ExternalLink size={12} />
                          {step.action || 'Abrir'}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Você já está no tier máximo!</p>
            </div>
          )}

          {/* Quality Score Info */}
          {accountLimits?.qualityScore && (
            <div className={`p-4 rounded-xl border ${accountLimits.qualityScore === 'GREEN'
              ? 'bg-green-500/10 border-green-500/30'
              : accountLimits.qualityScore === 'YELLOW'
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : accountLimits.qualityScore === 'RED'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-zinc-800/30 border-white/5'
              }`}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Qualidade da Conta</p>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${accountLimits.qualityScore === 'GREEN' ? 'bg-green-500' :
                  accountLimits.qualityScore === 'YELLOW' ? 'bg-yellow-500' :
                    accountLimits.qualityScore === 'RED' ? 'bg-red-500' : 'bg-gray-500'
                  }`} />
                <span className="text-sm text-white font-medium">
                  {accountLimits.qualityScore === 'GREEN' ? 'Alta (Verde)' :
                    accountLimits.qualityScore === 'YELLOW' ? 'Média (Amarela)' :
                      accountLimits.qualityScore === 'RED' ? 'Baixa (Vermelha)' : 'Desconhecida'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {accountLimits.qualityScore === 'RED'
                  ? 'Melhore a qualidade para poder evoluir de tier.'
                  : 'Mantenha a qualidade alta para evoluir automaticamente.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10 bg-zinc-800/30 shrink-0">
          <a
            href="https://developers.facebook.com/docs/whatsapp/messaging-limits"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-primary-400 flex items-center gap-1 transition-colors"
          >
            <ExternalLink size={14} />
            Documentação Meta
          </a>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-500 transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div >
  );
};

export const CampaignWizardView: React.FC<CampaignWizardViewProps> = ({
  step,
  setStep,
  name,
  setName,
  selectedTemplateId,
  setSelectedTemplateId,
  recipientSource,
  setRecipientSource,
  totalContacts,
  recipientCount,
  allContacts,
  selectedContacts,
  selectedContactIds,
  toggleContact,
  excelContacts,
  setExcelContacts,
  availableTemplates,
  selectedTemplate,
  handleNext,
  handleBack,
  handleSend,
  isCreating,
  isLoading,
  testContact,
  // Template Variables
  templateVariables,
  setTemplateVariables,
  templateVariableCount,
  templateVariableInfo,
  // Account Limits
  accountLimits,
  isBlockModalOpen,
  setIsBlockModalOpen,
  blockReason,
  liveValidation,
  isOverLimit = false,
  currentLimit = 250,
  antiBanConfig: antiBanConfigProp,
  setAntiBanConfig: setAntiBanConfigProp,
  providerType: providerTypeProp,
  additionalTemplateIds = [],
  setAdditionalTemplateIds,
  additionalTemplates = [],
}) => {
  // Anti-ban internal state (fallback when not provided as props)
  const [antiBanConfigInternal, setAntiBanConfigInternal] = React.useState<AntiBanConfig>(DEFAULT_ANTI_BAN);
  const antiBanConfig = antiBanConfigProp ?? antiBanConfigInternal;
  const setAntiBanConfig = setAntiBanConfigProp ?? setAntiBanConfigInternal;
  const providerType = providerTypeProp ?? 'meta';

  // State for upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // State for scheduling
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // State for template search
  const [templateSearch, setTemplateSearch] = useState('');

  // Filter templates based on search (or show only selected if one is chosen)
  const filteredTemplates = useMemo(() => {
    // If a template is selected, only show that one
    if (selectedTemplateId) {
      return availableTemplates.filter(t => t.id === selectedTemplateId);
    }
    // Otherwise, filter by search
    if (!templateSearch.trim()) {
      return availableTemplates;
    }
    const search = templateSearch.toLowerCase();
    return availableTemplates.filter(t =>
      t.name.toLowerCase().includes(search) ||
      t.content.toLowerCase().includes(search) ||
      t.category.toLowerCase().includes(search)
    );
  }, [availableTemplates, templateSearch, selectedTemplateId]);

  // Hook must be called before any conditional returns
  const { rate: exchangeRate, hasRate } = useExchangeRate();

  if (isLoading) return <div className="text-white">Carregando assistente...</div>;

  // Calculate accurate pricing (only show total if recipients are selected AND we have exchange rate)
  const pricing = selectedTemplate && recipientCount > 0 && hasRate
    ? getPricingBreakdown(selectedTemplate.category, recipientCount, 0, exchangeRate!)
    : { totalBRLFormatted: 'R$ --', pricePerMessageBRLFormatted: 'R$ --' };

  // Price per message for display in Step 1
  const pricePerMessage = selectedTemplate && hasRate
    ? getPricingBreakdown(selectedTemplate.category, 1, 0, exchangeRate!).pricePerMessageBRLFormatted
    : 'R$ --';

  const steps = [
    { number: 1, title: 'Configuração & Template' },
    { number: 2, title: 'Público' },
    { number: 3, title: 'Revisão & Lançamento' },
  ];

  return (
    <div className="h-full flex flex-col px-6 lg:px-10 py-4">
      {/* Header Navigation */}
      <div className="shrink-0 mb-4">
        <PrefetchLink href="/campaigns" className="text-xs text-gray-500 hover:text-white inline-flex items-center gap-1 transition-colors">
          <ChevronLeft size={12} /> Voltar para Campanhas
        </PrefetchLink>
      </div>

      {/* Main Bar: Title, Stepper, Cost */}
      <div className="flex items-center justify-between shrink-0 mb-8 gap-8">
        {/* Title */}
        <div className="shrink-0">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            Criar Campanha <span className="text-sm font-normal text-gray-500 bg-zinc-900 px-3 py-1 rounded-full border border-white/10">Rascunho</span>
          </h1>
        </div>

        {/* Centralized Stepper */}
        <div className="hidden lg:block flex-1 max-w-2xl px-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-4 transform -translate-y-1/2 w-full h-0.5 bg-zinc-800 -z-10" aria-hidden="true">
              <div
                className="h-full bg-primary-600 transition-all duration-500 ease-out"
                style={{ width: `${((step - 1) / 2) * 100}%` }}
              ></div>
            </div>
            {steps.map((s) => (
              <button
                type="button"
                key={s.number}
                className="flex flex-col items-center group"
                onClick={() => step > s.number && setStep(s.number)}
                disabled={step <= s.number}
                aria-current={step === s.number ? 'step' : undefined}
                aria-label={`${s.title}${step > s.number ? ' - concluído, clique para voltar' : step === s.number ? ' - etapa atual' : ' - etapa futura'}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-all duration-300 border-2 ${step >= s.number
                    ? 'bg-zinc-950 text-primary-400 border-primary-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-110'
                    : 'bg-zinc-950 text-gray-600 border-zinc-800 group-hover:border-zinc-700'
                    }`}
                  aria-hidden="true"
                >
                  {step > s.number ? <Check size={14} strokeWidth={3} /> : s.number}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${step >= s.number ? 'text-white' : 'text-gray-600'}`}>
                  {s.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Cost Info */}
        <div className="text-right hidden md:block shrink-0 min-w-[120px]">
          {step === 1 && selectedTemplate ? (
            <>
              <p className="text-xs text-gray-500">Custo Base</p>
              <p className="text-xl font-bold text-primary-400">{pricePerMessage}/msg</p>
              <p className="text-[10px] text-gray-600 mt-1">{selectedTemplate.category}</p>
            </>
          ) : recipientCount > 0 && selectedTemplate ? (
            <>
              <p className="text-xs text-gray-500">Custo Estimado</p>
              <p className="text-xl font-bold text-primary-400">{pricing.totalBRLFormatted}</p>
              <p className="text-[10px] text-gray-600 mt-1">
                {pricing.pricePerMessageBRLFormatted}/msg • {selectedTemplate.category}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500">Custo Estimado</p>
              <p className="text-xl font-bold text-gray-600">-</p>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Content - Form Area */}
        <div className="flex flex-col min-h-0 lg:col-span-9">
          <div className="glass-panel rounded-2xl flex-1 min-h-0 flex flex-col relative overflow-hidden">
            {/* Step 1: Setup & Template */}
            {step === 1 && (
              <div className="flex-1 min-h-0 flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-auto p-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Nome da Campanha</label>
                  <input
                    type="text"
                    className="w-full px-5 py-4 bg-zinc-900 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-all text-white placeholder-gray-600 text-lg font-medium"
                    placeholder="ex: Promoção de Verão"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4 ml-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Selecione o Template</label>
                    <PrefetchLink href="/templates" className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
                      <RefreshCw size={12} /> Gerenciar Templates
                    </PrefetchLink>
                  </div>

                  {/* Search bar - only show when no template is selected */}
                  {!selectedTemplateId && availableTemplates.length > 3 && (
                    <div className="relative mb-4">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                      <input
                        type="text"
                        placeholder="Buscar template por nome, conteúdo ou categoria..."
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-white/20 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-all text-white placeholder-gray-500 text-sm"
                      />
                      {templateSearch && (
                        <button
                          onClick={() => setTemplateSearch('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Selected template indicator with change button */}
                  {selectedTemplateId && (
                    <div className="mb-4 flex items-center justify-between p-3 bg-primary-500/10 border border-primary-500/30 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Check className="text-primary-400" size={16} />
                        <span className="text-sm text-primary-400">Template selecionado</span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedTemplateId('');
                          setTemplateSearch('');
                        }}
                        className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                      >
                        <RefreshCw size={12} /> Trocar template
                      </button>
                    </div>
                  )}

                  <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                    {availableTemplates.length === 0 && (
                      <div className="text-center p-8 border border-dashed border-white/10 rounded-xl">
                        <p className="text-gray-500 mb-2">Nenhum template aprovado encontrado.</p>
                        <PrefetchLink href="/templates" className="text-primary-400 text-sm hover:underline">Sincronizar Templates</PrefetchLink>
                      </div>
                    )}
                    {filteredTemplates.length === 0 && availableTemplates.length > 0 && !selectedTemplateId && (
                      <div className="text-center p-8 border border-dashed border-white/10 rounded-xl">
                        <p className="text-gray-500 mb-2">Nenhum template encontrado para &ldquo;{templateSearch}&rdquo;</p>
                        <button
                          onClick={() => setTemplateSearch('')}
                          className="text-primary-400 text-sm hover:underline"
                        >
                          Limpar busca
                        </button>
                      </div>
                    )}
                    {filteredTemplates.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={`relative border rounded-xl p-4 cursor-pointer transition-all duration-200 group flex items-start gap-4 ${selectedTemplateId === t.id
                          ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500'
                          : 'border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-900'
                          }`}
                      >
                        {/* Radio indicator */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${selectedTemplateId === t.id
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-zinc-600 bg-transparent group-hover:border-zinc-500'
                          }`}>
                          {selectedTemplateId === t.id && (
                            <div className="w-2 h-2 rounded-full bg-black" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className={`font-semibold text-sm truncate ${selectedTemplateId === t.id ? 'text-white' : 'text-gray-200'}`}>
                              {t.name}
                            </h3>
                            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider ml-2 flex-shrink-0">{t.category}</span>
                          </div>
                          <p className={`text-sm line-clamp-2 leading-relaxed transition-colors ${selectedTemplateId === t.id ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-400'}`}>
                            {t.content.split(/(\{\{.*?\}\})/).map((part, i) =>
                              part.match(/^\{\{.*?\}\}$/) ? (
                                <span key={i} className="font-medium text-primary-400/80">{part}</span>
                              ) : (
                                part
                              )
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Template Variables Section - Shows when template has extra variables */}
                {selectedTemplate && templateVariableInfo && templateVariableInfo.totalExtra > 0 && (
                  <div className="mt-8 p-6 bg-primary-500/5 border border-primary-500/20 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 bg-primary-500/20 rounded-lg">
                        <Sparkles className="text-primary-400" size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Variáveis do Template</h3>
                        <p className="text-xs text-gray-400 mt-1">
                          Preencha os valores que serão usados neste template.
                          Esses valores serão <span className="text-white">iguais para todos</span> os destinatários.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* BODY Variables */}
                      {templateVariableInfo.body.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider flex items-center gap-2">
                            <MessageSquare size={12} /> Variáveis do Texto
                          </p>
                          {templateVariableInfo.body.map((varInfo) => (
                            <div key={`body-${varInfo.index}`} className="flex items-center gap-3">
                              <span className={`w-12 text-center text-xs font-mono px-2 py-1.5 rounded ${varInfo.index === 1
                                ? 'bg-zinc-800 text-gray-400'
                                : 'bg-primary-500/20 text-primary-400'
                                }`}>
                                {varInfo.placeholder}
                              </span>
                              {varInfo.index === 1 ? (
                                <>
                                  <input
                                    type="text"
                                    value="Nome do Contato"
                                    disabled
                                    className="flex-1 px-4 py-2 bg-zinc-900/50 border border-white/5 rounded-lg text-gray-500 text-sm cursor-not-allowed"
                                  />
                                  <span className="text-xs text-gray-500">automático</span>
                                </>
                              ) : (
                                <>
                                  <input
                                    type="text"
                                    value={templateVariables?.[varInfo.index - 2] || ''}
                                    onChange={(e) => {
                                      if (setTemplateVariables && templateVariables) {
                                        const newVars = [...templateVariables];
                                        newVars[varInfo.index - 2] = e.target.value;
                                        setTemplateVariables(newVars);
                                      }
                                    }}
                                    placeholder={varInfo.context}
                                    className="flex-1 px-4 py-2 bg-zinc-900/50 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-all text-white text-sm placeholder-gray-600"
                                  />
                                  {!templateVariables?.[varInfo.index - 2] ? (
                                    <span className="text-xs text-amber-400">obrigatório</span>
                                  ) : (
                                    <Check size={16} className="text-primary-400" />
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* HEADER Variables */}
                      {templateVariableInfo.header.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider flex items-center gap-2">
                            <Eye size={12} /> Variáveis do Cabeçalho
                          </p>
                          {templateVariableInfo.header.map((varInfo, idx) => (
                            <div key={`header-${varInfo.index}`} className="flex items-center gap-3">
                              <span className="w-12 text-center text-xs font-mono bg-blue-500/20 text-blue-400 px-2 py-1.5 rounded">
                                {varInfo.placeholder}
                              </span>
                              <input
                                type="text"
                                value={templateVariables?.[templateVariableInfo.body.filter(b => b.index > 1).length + idx] || ''}
                                onChange={(e) => {
                                  if (setTemplateVariables && templateVariables) {
                                    const newVars = [...templateVariables];
                                    const bodyVarsCount = templateVariableInfo.body.filter(b => b.index > 1).length;
                                    newVars[bodyVarsCount + idx] = e.target.value;
                                    setTemplateVariables(newVars);
                                  }
                                }}
                                placeholder={varInfo.context}
                                className="flex-1 px-4 py-2 bg-zinc-900/50 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all text-white text-sm placeholder-gray-600"
                              />
                              {!templateVariables?.[templateVariableInfo.body.filter(b => b.index > 1).length + idx] ? (
                                <span className="text-xs text-amber-400">obrigatório</span>
                              ) : (
                                <Check size={16} className="text-blue-400" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* BUTTON URL Variables */}
                      {templateVariableInfo.buttons.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider flex items-center gap-2">
                            <ExternalLink size={12} /> URLs Dinâmicas dos Botões
                          </p>
                          {templateVariableInfo.buttons.map((varInfo, idx) => {
                            const bodyVarsCount = templateVariableInfo.body.filter(b => b.index > 1).length;
                            const headerVarsCount = templateVariableInfo.header.length;
                            const varIndex = bodyVarsCount + headerVarsCount + idx;
                            return (
                              <div key={`button-${varInfo.buttonIndex}`} className="flex items-center gap-3">
                                <span className="w-auto min-w-[48px] text-center text-xs font-mono bg-amber-500/20 text-amber-400 px-2 py-1.5 rounded">
                                  {`Botão ${varInfo.buttonIndex + 1}`}
                                </span>
                                <input
                                  type="text"
                                  value={templateVariables?.[varIndex] || ''}
                                  onChange={(e) => {
                                    if (setTemplateVariables && templateVariables) {
                                      const newVars = [...templateVariables];
                                      newVars[varIndex] = e.target.value;
                                      setTemplateVariables(newVars);
                                    }
                                  }}
                                  placeholder={`Parte dinâmica da URL do botão "${varInfo.buttonText}"`}
                                  className="flex-1 px-4 py-2 bg-zinc-900/50 border border-white/10 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none transition-all text-white text-sm placeholder-gray-600"
                                />
                                {!templateVariables?.[varIndex] ? (
                                  <span className="text-xs text-amber-400">obrigatório</span>
                                ) : (
                                  <Check size={16} className="text-amber-400" />
                                )}
                              </div>
                            );
                          })}
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 pl-1">
                            <AlertCircle size={11} />
                            Ex: Se a URL é <code className="bg-zinc-800 px-1 rounded">zoom.us/j/{'{{1}}'}</code>, preencha apenas o ID da reunião
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* Multi-Template Section (anti-ban rotation) */}
            {step === 1 && selectedTemplateId && setAdditionalTemplateIds && (
              <div className="px-6 pb-2">
                <div className="border border-white/10 rounded-xl p-4 bg-zinc-900/40">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-amber-400" />
                      <span className="text-sm font-medium text-white">Templates adicionais</span>
                      <span className="text-[10px] text-gray-500 bg-zinc-800 px-2 py-0.5 rounded-full">anti-ban</span>
                    </div>
                    <span className="text-xs text-gray-500">Sorteia 1 por contato</span>
                  </div>
                  {additionalTemplates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {additionalTemplates.map(t => t && (
                        <div key={t.id} className="flex items-center gap-1.5 bg-primary-500/15 border border-primary-500/30 rounded-lg px-2.5 py-1 text-xs text-primary-300">
                          <span className="truncate max-w-[150px]">{t.name}</span>
                          <button
                            onClick={() => setAdditionalTemplateIds(additionalTemplateIds.filter(id => id !== t.id))}
                            className="hover:text-red-400 transition-colors flex-shrink-0"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <select
                    className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-primary-500/50"
                    value=""
                    onChange={e => {
                      const id = e.target.value;
                      if (id && id !== selectedTemplateId && !additionalTemplateIds.includes(id)) {
                        setAdditionalTemplateIds([...additionalTemplateIds, id]);
                      }
                    }}
                  >
                    <option value="">+ Adicionar template para rotação...</option>
                    {availableTemplates
                      .filter(t => t.id !== selectedTemplateId && !additionalTemplateIds.includes(t.id))
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))
                    }
                  </select>
                </div>
              </div>
            )}

                        {/* Provider type toggle + Anti-Ban Settings (shown in Step 1) */}
            {step === 1 && (
              <div className="px-6 pb-6 space-y-3">
                {/* Provider selector */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { if (setProviderType) setProviderType('meta') }}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${providerType === 'meta' ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}
                  >
                    Meta Cloud API
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (setProviderType) setProviderType('evolution') }}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${providerType === 'evolution' ? 'bg-green-600/20 border-green-500/50 text-green-300' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}
                  >
                    WhatsApp Business App (QR Code)
                  </button>
                </div>
                <AntiBanSettings
                  value={antiBanConfig}
                  onChange={setAntiBanConfig}
                  providerType={providerType}
                />
              </div>
            )}

            {/* Step 2: Recipients */}
            {step === 2 && (
              <div className="flex-1 min-h-0 flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-auto p-6 pb-8">
                <div className="text-center mb-4 shrink-0">
                  <h2 className="text-2xl font-bold text-white mb-2">Escolha seu Público</h2>
                  <p className="text-gray-400">Quem deve receber esta campanha?</p>
                </div>

                {/* Test Contact Card - Always visible if configured */}
                {testContact && (
                  <div className="mb-4">
                    <button
                      onClick={() => setRecipientSource('test')}
                      className={`relative w-full p-4 rounded-2xl border transition-all duration-200 flex items-center gap-4 ${recipientSource === 'test'
                        ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                        : 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50 text-amber-300'
                        }`}
                    >
                      {recipientSource === 'test' && (
                        <div className="absolute top-3 right-3 text-black">
                          <CheckCircleFilled size={18} />
                        </div>
                      )}
                      <div className={`p-3 rounded-xl ${recipientSource === 'test'
                        ? 'bg-black/20 text-black'
                        : 'bg-amber-500/20 text-amber-400'
                        }`}>
                        <FlaskConical size={20} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm">Enviar para Contato de Teste</h3>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${recipientSource === 'test' ? 'bg-black/20' : 'bg-amber-500/20'
                            }`}>
                            RECOMENDADO
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${recipientSource === 'test' ? 'text-black/70' : 'text-amber-400/70'}`}>
                          {testContact.name || 'Contato de Teste'} • +{testContact.phone}
                        </p>
                      </div>
                      {recipientSource === 'test' && selectedTemplate && (
                        <div className="text-right">
                          <p className="text-xs font-bold text-black">
                            {getPricingBreakdown(selectedTemplate.category, 1, 0, exchangeRate ?? 5.00).totalBRLFormatted}
                          </p>
                        </div>
                      )}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* All Contacts - Shows error style when exceeds limit */}
                  <button
                    onClick={() => setRecipientSource('all')}
                    className={`relative p-6 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-4 ${recipientSource === 'all' && totalContacts > currentLimit
                      ? 'bg-red-500/10 text-red-300 border-red-500/50 scale-105'
                      : recipientSource === 'all'
                        ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)] scale-105'
                        : totalContacts > currentLimit
                          ? 'bg-zinc-900/50 border-red-500/30 text-gray-400 opacity-60'
                          : 'bg-zinc-900/50 border-white/10 hover:bg-zinc-900 hover:border-white/20 text-gray-300'
                      }`}
                  >
                    {recipientSource === 'all' && totalContacts <= currentLimit && (
                      <div className="absolute top-3 right-3 text-black">
                        <CheckCircleFilled size={20} />
                      </div>
                    )}
                    {totalContacts > currentLimit && (
                      <div className="absolute top-3 right-3 text-red-400">
                        <ShieldAlert size={18} />
                      </div>
                    )}
                    <div className={`p-4 rounded-full ${totalContacts > currentLimit
                      ? 'bg-red-500/20 text-red-400'
                      : recipientSource === 'all'
                        ? 'bg-gray-200 text-black'
                        : 'bg-zinc-800 text-gray-400'
                      }`}>
                      <Users size={24} />
                    </div>
                    <div className="text-center">
                      <h3 className="font-bold text-sm">Todos os Contatos</h3>
                      <p className={`text-xs mt-1 ${totalContacts > currentLimit ? 'text-red-400' : recipientSource === 'all' ? 'text-gray-600' : 'text-gray-500'}`}>
                        {totalContacts} contatos
                      </p>
                      {totalContacts > currentLimit ? (
                        <p className="text-xs mt-2 font-bold text-red-400">
                          Excede limite ({currentLimit})
                        </p>
                      ) : recipientSource === 'all' && selectedTemplate ? (
                        <p className="text-xs mt-2 font-bold text-primary-600">
                          {getPricingBreakdown(selectedTemplate.category, totalContacts, 0, exchangeRate ?? 5.00).totalBRLFormatted}
                        </p>
                      ) : null}
                    </div>
                  </button>

                  {/* Select Specific - Highlighted as solution when All exceeds */}
                  <button
                    onClick={() => setRecipientSource('specific')}
                    className={`relative p-6 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-4 ${recipientSource === 'specific'
                      ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)] scale-105'
                      : totalContacts > currentLimit && recipientSource === 'all'
                        ? 'bg-primary-500/10 border-primary-500/50 text-primary-300 hover:bg-primary-500/20 ring-2 ring-primary-500/30'
                        : 'bg-zinc-900/50 border-white/10 hover:bg-zinc-900 hover:border-white/20 text-gray-300'
                      }`}
                  >
                    {recipientSource === 'specific' && (
                      <div className="absolute top-3 right-3 text-black">
                        <CheckCircleFilled size={20} />
                      </div>
                    )}
                    {totalContacts > currentLimit && recipientSource !== 'specific' && (
                      <div className="absolute top-3 right-3 text-primary-400">
                        <Sparkles size={18} />
                      </div>
                    )}
                    <div className={`p-4 rounded-full ${recipientSource === 'specific'
                      ? 'bg-gray-200 text-black'
                      : totalContacts > currentLimit
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'bg-zinc-800 text-gray-400'
                      }`}>
                      <Smartphone size={24} />
                    </div>
                    <div className="text-center">
                      <h3 className="font-bold text-sm">
                        {totalContacts > currentLimit && recipientSource !== 'specific' ? '✨ Selecionar Específicos' : 'Selecionar Específicos'}
                      </h3>
                      <p className={`text-xs mt-1 ${totalContacts > currentLimit && recipientSource !== 'specific'
                        ? 'text-primary-400 font-medium'
                        : recipientSource === 'specific'
                          ? 'text-gray-600'
                          : 'text-gray-500'
                        }`}>
                        {recipientSource === 'specific'
                          ? `${recipientCount} selecionados`
                          : totalContacts > currentLimit
                            ? `Selecione até ${currentLimit}`
                            : 'Escolher contatos'
                        }
                      </p>
                      {recipientSource === 'specific' && selectedTemplate && recipientCount > 0 && (
                        <p className="text-xs mt-2 font-bold text-primary-600">
                          {getPricingBreakdown(selectedTemplate.category, recipientCount, 0, exchangeRate ?? 5.00).totalBRLFormatted}
                        </p>
                      )}
                    </div>
                  </button>

                  {/* Excel / CSV Upload */}
                  <button
                    onClick={() => setRecipientSource('excel')}
                    className={`relative p-6 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-4 md:col-span-2 ${recipientSource === 'excel'
                      ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)] scale-105'
                      : 'bg-zinc-900/50 border-white/10 hover:bg-zinc-900 hover:border-white/20 text-gray-300'
                      }`}
                  >
                    {recipientSource === 'excel' && (
                      <div className="absolute top-3 right-3 text-black">
                        <CheckCircleFilled size={20} />
                      </div>
                    )}
                    <div className="flex items-center gap-4 w-full justify-center">
                      <div className={`p-4 rounded-full ${recipientSource === 'excel' ? 'bg-gray-200 text-black' : 'bg-zinc-800 text-emerald-400'}`}>
                        <FileSpreadsheet size={24} />
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-sm">Importar Excel / CSV</h3>
                        <p className={`text-xs mt-0.5 ${recipientSource === 'excel' ? 'text-gray-600' : 'text-gray-500'}`}>
                          {recipientSource === 'excel' && excelContacts.length > 0
                            ? `${excelContacts.length} contatos importados`
                            : 'Carregue uma planilha com nome e telefone'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Excel File Uploader */}
                {recipientSource === 'excel' && (
                  <ExcelUploader
                    excelContacts={excelContacts}
                    setExcelContacts={setExcelContacts}
                  />
                )}

                {/* Contact Selection List */}
                {recipientSource === 'specific' && (
                  <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 mt-6 animate-in zoom-in duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-bold text-sm">Seus Contatos</h4>
                      <span className="text-xs text-gray-500">{recipientCount}/{totalContacts} selecionados</span>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {allContacts.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-8">Nenhum contato encontrado</p>
                      ) : (
                        allContacts.map((contact) => {
                          const isSelected = selectedContactIds.includes(contact.id);
                          return (
                            <label
                              key={contact.id}
                              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${isSelected
                                ? 'bg-primary-500/10 border border-primary-500/30'
                                : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleContact(contact.id)}
                                className="w-4 h-4 text-primary-600 bg-zinc-700 border-zinc-600 rounded focus:ring-primary-500"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{contact.name || contact.phone}</p>
                                <p className="text-xs text-gray-500 font-mono">{contact.phone}</p>
                              </div>
                              {isSelected && (
                                <Check size={16} className="text-primary-400 flex-shrink-0" />
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* ⚠️ CONSOLIDATED LIMIT WARNING - Everything user needs to know */}
                {recipientCount > 0 && isOverLimit && liveValidation && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex gap-3">
                      <ShieldAlert className="text-red-400 flex-shrink-0 mt-0.5" size={22} />
                      <div className="flex-1">
                        <p className="font-bold text-red-400 text-base mb-1">⛔ Limite Excedido</p>
                        <p className="text-sm text-red-200/80">
                          Você selecionou <span className="font-bold text-white">{recipientCount}</span> contatos,
                          mas seu limite atual é de <span className="font-bold text-white">{currentLimit}</span> mensagens/dia.
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 bg-black/20 rounded-lg p-3">
                      <div className="text-center">
                        <p className="text-lg font-bold text-white">{recipientCount}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Selecionados</p>
                      </div>
                      <div className="text-center border-x border-white/10">
                        <p className="text-lg font-bold text-primary-400">{currentLimit}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Seu Limite</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-red-400">+{recipientCount - currentLimit}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Excedente</p>
                      </div>
                    </div>

                    {/* Solutions */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">O que você pode fazer:</p>
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-xs">1</span>
                        Reduza a seleção para no máximo <span className="font-bold text-primary-400">{currentLimit}</span> contatos
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-xs">2</span>
                        Divida em {Math.ceil(recipientCount / currentLimit)} campanhas menores
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <span className="w-5 h-5 rounded-full bg-primary-500/30 flex items-center justify-center text-xs text-primary-400">✦</span>
                        <button
                          onClick={() => setShowUpgradeModal(true)}
                          className="text-primary-400 hover:text-primary-300 underline"
                        >
                          Saiba como aumentar seu limite →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="flex-1 min-h-0 flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-auto p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-zinc-900/50 border border-white/5 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Custo Total</p>
                    <p className="text-2xl font-bold text-white">{pricing.totalBRLFormatted}</p>
                    {selectedTemplate && (
                      <p className="text-xs text-gray-500 mt-1">
                        {pricing.pricePerMessageBRLFormatted} × {recipientCount} msgs
                      </p>
                    )}
                  </div>
                  <div className="p-5 bg-zinc-900/50 border border-white/5 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Destinatários</p>
                    <p className="text-2xl font-bold text-white">{recipientCount}</p>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-6 space-y-4">
                  <h3 className="text-sm font-bold text-white mb-4">Detalhes da Campanha</h3>

                  <div className="flex items-center justify-between group">
                    <span className="text-sm text-gray-500">Nome da Campanha</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{name}</span>
                      <button onClick={() => setStep(1)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-primary-400 transition-all"><small>Editar</small></button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between group">
                    <span className="text-sm text-gray-500">Template</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-mono bg-zinc-900 px-2 py-1 rounded text-xs">{selectedTemplateId}</span>
                      <button onClick={() => setStep(1)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-primary-400 transition-all"><small>Editar</small></button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between group">
                    <span className="text-sm text-gray-500">Público</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">
                        {recipientSource === 'test'
                          ? `🧪 Contato de Teste (${testContact?.name})`
                          : recipientSource === 'all'
                            ? 'Todos os Contatos'
                            : 'Contatos Selecionados'
                        } ({recipientCount})
                      </span>
                      <button onClick={() => setStep(2)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-primary-400 transition-all"><small>Editar</small></button>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex gap-3">
                  <AlertCircle className="text-amber-500 flex-shrink-0" size={20} />
                  <div className="text-xs text-amber-200/70">
                    <p className="font-bold text-amber-500 mb-1">Checagem Final</p>
                    <p>Ao clicar em disparar, você confirma que todos os destinatários aceitaram receber mensagens do seu negócio.</p>
                  </div>
                </div>

                {/* Scheduling Options */}
                <div className="border-t border-white/5 pt-6 space-y-4">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Clock size={16} className="text-primary-400" />
                    Quando enviar?
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Send Now Option */}
                    <button
                      type="button"
                      onClick={() => setScheduleMode('now')}
                      className={`relative p-4 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-3 ${scheduleMode === 'now'
                        ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                        : 'bg-zinc-900/50 border-white/10 hover:bg-zinc-900 hover:border-white/20 text-gray-300'
                        }`}
                    >
                      {scheduleMode === 'now' && (
                        <div className="absolute top-2 right-2 text-black">
                          <CheckCircle size={16} />
                        </div>
                      )}
                      <div className={`p-2 rounded-lg ${scheduleMode === 'now'
                        ? 'bg-gray-200 text-black'
                        : 'bg-zinc-800 text-gray-400'
                        }`}>
                        <Zap size={18} />
                      </div>
                      <div className="text-center">
                        <h4 className="font-bold text-sm">Enviar Agora</h4>
                        <p className={`text-xs mt-1 ${scheduleMode === 'now' ? 'text-gray-600' : 'text-gray-500'}`}>
                          Disparo imediato
                        </p>
                      </div>
                    </button>

                    {/* Schedule Option */}
                    <button
                      type="button"
                      onClick={() => setScheduleMode('scheduled')}
                      className={`relative p-4 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-3 ${scheduleMode === 'scheduled'
                        ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                        : 'bg-zinc-900/50 border-white/10 hover:bg-zinc-900 hover:border-white/20 text-gray-300'
                        }`}
                    >
                      {scheduleMode === 'scheduled' && (
                        <div className="absolute top-2 right-2 text-black">
                          <CheckCircle size={16} />
                        </div>
                      )}
                      <div className={`p-2 rounded-lg ${scheduleMode === 'scheduled'
                        ? 'bg-gray-200 text-black'
                        : 'bg-zinc-800 text-gray-400'
                        }`}>
                        <Calendar size={18} />
                      </div>
                      <div className="text-center">
                        <h4 className="font-bold text-sm">Agendar</h4>
                        <p className={`text-xs mt-1 ${scheduleMode === 'scheduled' ? 'text-gray-600' : 'text-gray-500'}`}>
                          Escolher data e hora
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Date/Time Picker (shown when scheduled) */}
                  {scheduleMode === 'scheduled' && (
                    <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-500 mb-2">Data</label>
                          <input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-3 bg-zinc-800 border border-white/10 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-2">Horário</label>
                          <input
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            className="w-full px-4 py-3 bg-zinc-800 border border-white/10 rounded-lg text-white text-sm focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none"
                          />
                        </div>
                      </div>
                      {scheduledDate && scheduledTime && (
                        <div className="mt-3 p-3 bg-primary-500/10 border border-primary-500/20 rounded-lg">
                          <p className="text-xs text-primary-400 flex items-center gap-2">
                            <Calendar size={14} />
                            Campanha será enviada em{' '}
                            <span className="font-bold text-white">
                              {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString('pt-BR', {
                                dateStyle: 'long',
                                timeStyle: 'short'
                              })}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ⚠️ LIMIT WARNING IN REVIEW */}
                {isOverLimit && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <ShieldAlert className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <p className="font-bold text-red-400 text-sm mb-1">⛔ Não é possível disparar</p>
                      <p className="text-sm text-red-200/70">
                        Você selecionou <span className="font-bold text-white">{recipientCount}</span> contatos,
                        mas seu limite é <span className="font-bold text-white">{currentLimit}</span>/dia.
                      </p>
                      <button
                        onClick={() => setStep(2)}
                        className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                      >
                        ← Voltar e ajustar destinatários
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center p-6 border-t border-white/5 bg-zinc-900/30 mt-auto">
              {step > 1 ? (
                <button
                  onClick={handleBack}
                  className="px-6 py-3 rounded-xl text-gray-400 font-medium hover:text-white transition-colors flex items-center gap-2 hover:bg-white/5"
                >
                  <ChevronLeft size={18} /> Voltar
                </button>
              ) : (
                <div></div>
              )}

              {step < 3 ? (
                // Hide button completely if over limit on Step 2 - the cards guide the user
                step === 2 && isOverLimit ? null : (
                  <button
                    onClick={handleNext}
                    className="group relative px-8 py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2">Continuar <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" /></span>
                  </button>
                )
              ) : isOverLimit ? null : (
                <button
                  onClick={() => {
                    if (scheduleMode === 'scheduled' && scheduledDate && scheduledTime) {
                      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
                      handleSend(scheduledAt);
                    } else {
                      handleSend();
                    }
                  }}
                  disabled={isCreating || (scheduleMode === 'scheduled' && (!scheduledDate || !scheduledTime))}
                  className={`group relative px-10 py-3 rounded-xl ${scheduleMode === 'scheduled'
                    ? 'bg-purple-600 hover:bg-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:shadow-[0_0_40px_rgba(147,51,234,0.6)]'
                    : 'bg-primary-600 hover:bg-primary-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)]'
                    } text-white font-bold transition-all flex items-center gap-2 hover:scale-105 ${isCreating || (scheduleMode === 'scheduled' && (!scheduledDate || !scheduledTime)) ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isCreating
                      ? 'Processando...'
                      : scheduleMode === 'scheduled'
                        ? 'Agendar Campanha'
                        : 'Disparar Campanha'
                    }
                    {!isCreating && (scheduleMode === 'scheduled' ? <Calendar size={18} /> : <Zap size={18} className="fill-white" />)}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Content - Preview Panel */}
        <div className={`hidden lg:flex flex-col lg:col-span-3 bg-zinc-900/30 rounded-2xl border border-white/5 p-4 ${step === 2 && isOverLimit ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-widest font-bold">
                <Eye size={14} /> Pré-visualização
              </div>
              {step === 2 && isOverLimit && <span className="text-red-400 text-[10px]">(ajuste os contatos)</span>}
            </div>

            {/* Phone Mockup - Universal Component */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <WhatsAppPhonePreview
                components={selectedTemplate?.components}
                fallbackContent={selectedTemplate?.content}
                variables={(() => {
                  // Build preview variables: [contactName, ...templateVariables]
                  const contactName = recipientSource === 'test' && testContact
                    ? (testContact.name || testContact.phone)
                    : 'Thales'; // Default preview name

                  // Combine contact name with user-filled template variables
                  return [contactName, ...(templateVariables || [])];
                })()}
                showEmptyState={!selectedTemplateId}
                emptyStateMessage="Selecione um template ao lado para visualizar"
                size="adaptive"
                className="max-h-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Bloqueio */}
      <CampaignBlockModal
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        validation={blockReason}
        accountLimits={accountLimits}
      />

      {/* Modal de Upgrade */}
      <UpgradeRoadmapModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        accountLimits={accountLimits}
      />
    </div>
  );
};
