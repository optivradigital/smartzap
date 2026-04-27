import React, { useState, useRef } from 'react';
import {
  Plus, Search, Filter, Tag, X, Trash2, UploadCloud, CheckCircle2,
  AlertCircle, Loader2, FileText, Edit3, ChevronLeft, ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { Contact, ContactStatus } from '../../../types';

// ContactStats type inline to avoid import issues
interface ContactStats {
  total: number;
  optIn: number;
  optOut: number;
}

// Helper para ler CSV simples
const parseCSV = (text: string) => {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
  const rows = lines.slice(1).map(line => {
    return line.split(',').map(cell => cell.trim().replace(/['"]/g, ''));
  });
  return { headers, rows };
};

const calculateRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Agora mesmo';
  if (diffInSeconds < 3600) return `Há ${Math.floor(diffInSeconds / 60)} minutos`;
  if (diffInSeconds < 86400) return `Há ${Math.floor(diffInSeconds / 3600)} horas`;
  if (diffInSeconds < 604800) return `Há ${Math.floor(diffInSeconds / 86400)} dias`;
  return date.toLocaleDateString('pt-BR');
};

export interface ImportContact {
  name: string;
  phone: string;
  status: ContactStatus;
  tags: string[];
}

interface ContactListViewProps {
  // Data
  contacts: Contact[];
  stats: ContactStats;
  tags: string[];
  isLoading: boolean;

  // Search & Filters
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: ContactStatus | 'ALL';
  onStatusFilterChange: (status: ContactStatus | 'ALL') => void;
  tagFilter: string;
  onTagFilterChange: (tag: string) => void;

  // Pagination
  currentPage: number;
  totalPages: number;
  totalFiltered: number;
  onPageChange: (page: number) => void;

  // Selection
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;

  // Modals
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  isImportModalOpen: boolean;
  setIsImportModalOpen: (open: boolean) => void;
  isEditModalOpen: boolean;
  setIsEditModalOpen: (open: boolean) => void;
  isDeleteModalOpen: boolean;
  editingContact: Contact | null;
  deleteTarget: { type: 'single' | 'bulk'; id?: string } | null;

  // Actions
  onAddContact: (contact: { name: string; phone: string; tags: string }) => void;
  onEditContact: (contact: Contact) => void;
  onUpdateContact: (data: { name: string; phone: string; tags: string; status: ContactStatus }) => void;
  onDeleteClick: (id: string) => void;
  onBulkDeleteClick: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onImport: (contacts: ImportContact[]) => Promise<number>;
  isImporting: boolean;
  isDeleting: boolean;
}

export const ContactListView: React.FC<ContactListViewProps> = ({
  contacts,
  stats,
  tags,
  isLoading,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  tagFilter,
  onTagFilterChange,
  currentPage,
  totalPages,
  totalFiltered,
  onPageChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  isSomeSelected,
  isAddModalOpen,
  setIsAddModalOpen,
  isImportModalOpen,
  setIsImportModalOpen,
  isEditModalOpen,
  setIsEditModalOpen,
  isDeleteModalOpen,
  editingContact,
  deleteTarget,
  onAddContact,
  onEditContact,
  onUpdateContact,
  onDeleteClick,
  onBulkDeleteClick,
  onConfirmDelete,
  onCancelDelete,
  onImport,
  isImporting,
  isDeleting
}) => {
  // Local state for modals
  const [newContact, setNewContact] = useState({ name: '', phone: '', tags: '' });
  const [editForm, setEditForm] = useState({ name: '', phone: '', tags: '', status: ContactStatus.OPT_IN });
  const [showFilters, setShowFilters] = useState(false);

  // Import State
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ headers: string[], rows: string[][] }>({ headers: [], rows: [] });
  const [columnMapping, setColumnMapping] = useState({ name: '', phone: '', tags: '', defaultTag: '' });
  const [importResult, setImportResult] = useState({ total: 0, success: 0, errors: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync edit form when editing contact changes
  React.useEffect(() => {
    if (editingContact) {
      setEditForm({
        name: editingContact.name ?? '',
        phone: editingContact.phone,
        tags: editingContact.tags.join(', '),
        status: editingContact.status
      });
    }
  }, [editingContact]);

  if (isLoading) return (
    <div className="space-y-6">
      <div className="h-8 w-36 bg-zinc-800/80 rounded-lg animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="glass-panel p-5 rounded-2xl h-20 animate-pulse" />)}
      </div>
      <div className="glass-panel rounded-2xl overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex gap-4 px-5 py-4 border-b border-white/5">
            <div className="w-4 h-4 rounded bg-zinc-800 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-zinc-800/80 rounded animate-pulse" />
              <div className="h-3 w-28 bg-zinc-800/50 rounded animate-pulse" />
            </div>
            <div className="h-6 w-16 bg-zinc-800/80 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );

  // --- Import Handlers ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      return;
    }

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { headers, rows } = parseCSV(text);

      if (headers.length === 0 || rows.length === 0) {
        return;
      }

      setCsvPreview({ headers, rows: rows.slice(0, 3) });

      const lowerHeaders = headers.map(h => h.toLowerCase());
      setColumnMapping({
        name: headers[lowerHeaders.findIndex(h => h.includes('nome') || h.includes('name'))] || '',
        phone: headers[lowerHeaders.findIndex(h => h.includes('tele') || h.includes('phone') || h.includes('cel') || h.includes('what'))] || '',
        tags: headers[lowerHeaders.findIndex(h => h.includes('tag') || h.includes('grupo'))] || '',
        defaultTag: ''
      });

      setImportStep(2);
    };
    reader.readAsText(file);
  };

  const executeImport = () => {
    if (!columnMapping.phone) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const { headers, rows } = parseCSV(text);

      const nameIdx = headers.indexOf(columnMapping.name);
      const phoneIdx = headers.indexOf(columnMapping.phone);
      const tagsIdx = headers.indexOf(columnMapping.tags);

      const contactsToImport = rows.map(row => {
        let phone = row[phoneIdx] || '';
        phone = phone.replace(/\D/g, '');
        if (phone.length > 0 && !phone.startsWith('55') && phone.length > 9) {
          phone = '55' + phone;
        }
        if (phone.length > 0) phone = '+' + phone;

        return {
          name: nameIdx >= 0 ? row[nameIdx] : 'Sem Nome',
          phone: phone,
          status: ContactStatus.UNKNOWN,
          tags: tagsIdx >= 0
            ? row[tagsIdx].split(';').map(t => t.trim())
            : columnMapping.defaultTag
              ? columnMapping.defaultTag.split(',').map(t => t.trim())
              : ['Importado']
        };
      }).filter(c => c.phone.length > 8);

      const importedCount = await onImport(contactsToImport);

      setImportResult({
        total: rows.length,
        success: importedCount,
        errors: rows.length - importedCount
      });
      setImportStep(3);
    };
    reader.readAsText(csvFile!);
  };

  const resetImport = () => {
    setIsImportModalOpen(false);
    setTimeout(() => {
      setImportStep(1);
      setCsvFile(null);
      setCsvPreview({ headers: [], rows: [] });
      setColumnMapping({ name: '', phone: '', tags: '', defaultTag: '' });
    }, 300);
  };

  const statusOptions = [
    { value: 'ALL', label: 'Todos Status' },
    { value: ContactStatus.OPT_IN, label: 'Opt-in' },
    { value: ContactStatus.OPT_OUT, label: 'Opt-out' },
    { value: ContactStatus.UNKNOWN, label: 'Desconhecido' }
  ];

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none mb-1">Contatos</h1>
          <p className="text-sm text-muted-foreground">Gerencie sua audiência e listas</p>
        </div>
        <div className="flex items-center gap-2">
          {isSomeSelected && (
            <button
              onClick={onBulkDeleteClick}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 font-medium hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={15} />
              Excluir ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-muted dark:bg-zinc-900 border border-border dark:border-zinc-800 rounded-xl text-sm text-foreground font-medium hover:bg-accent transition-all"
          >
            <UploadCloud size={15} />
            Importar CSV
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary-900/30"
          >
            <Plus size={15} />
            Novo Contato
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-zinc-600 opacity-40" />
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest mb-1.5">Total</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{(stats?.total ?? 0).toLocaleString()}</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-emerald-500 opacity-50" />
          <p className="text-[11px] text-emerald-500/70 font-semibold uppercase tracking-widest mb-1.5">Opt-in Ativos</p>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{(stats?.optIn ?? 0).toLocaleString()}</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-zinc-600 opacity-30" />
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest mb-1.5">Opt-out / Inativos</p>
          <p className="text-2xl font-bold text-muted-foreground tabular-nums">{(stats?.optOut ?? 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel rounded-2xl">
        <div className="p-4 border-b border-white/5 flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="flex items-center gap-2.5 flex-1 bg-muted dark:bg-zinc-900 border border-border dark:border-zinc-800 rounded-xl px-3.5 py-2.5 max-w-sm focus-within:border-primary-500/40 focus-within:ring-1 focus-within:ring-primary-500/20 transition-all">
            <Search size={15} className="text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          {/* Filter Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2.5 rounded-xl border transition-all ${showFilters || statusFilter !== 'ALL' || tagFilter !== 'ALL'
                ? 'text-primary-400 bg-primary-500/10 border-primary-500/30'
                : 'text-muted-foreground hover:text-foreground bg-muted dark:bg-zinc-900 border-border dark:border-zinc-800'
                }`}
            >
              <Filter size={15} />
            </button>

            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as ContactStatus | 'ALL')}
              className="px-3 py-2.5 text-xs font-medium bg-muted dark:bg-zinc-900 text-foreground rounded-xl border border-border dark:border-zinc-800 outline-none cursor-pointer transition-colors hover:border-primary-500/50"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <select
              value={tagFilter}
              onChange={(e) => onTagFilterChange(e.target.value)}
              className="px-3 py-2.5 text-xs font-medium bg-muted dark:bg-zinc-900 text-foreground rounded-xl border border-border dark:border-zinc-800 outline-none cursor-pointer transition-colors hover:border-primary-500/50"
            >
              <option value="ALL">Todas Tags</option>
              {tags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Info */}
        <div className="px-5 py-3 bg-white/[0.02] border-b border-white/5 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Mostrando <span className="text-white font-medium">{contacts.length}</span> de{' '}
            <span className="text-white font-medium">{totalFiltered}</span> contatos
          </span>
          {(statusFilter !== 'ALL' || tagFilter !== 'ALL' || searchTerm) && (
            <button
              onClick={() => {
                onSearchChange('');
                onStatusFilterChange('ALL');
                onTagFilterChange('ALL');
              }}
              className="text-primary-400 hover:text-primary-300 text-xs font-medium"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="Lista de contatos">
            <thead className="bg-white/5 text-gray-400 uppercase text-xs tracking-wider">
              <tr>
                <th scope="col" className="w-8 px-6 py-4">
                  <label className="sr-only" htmlFor="select-all">Selecionar todos os contatos</label>
                  <input
                    id="select-all"
                    type="checkbox"
                    className="rounded border-white/10 bg-zinc-800 checked:bg-primary-500"
                    checked={isAllSelected}
                    onChange={onToggleSelectAll}
                    aria-label="Selecionar todos os contatos"
                  />
                </th>
                <th scope="col" className="px-6 py-4 font-medium">Contato</th>
                <th scope="col" className="px-6 py-4 font-medium">Tags</th>
                <th scope="col" className="px-6 py-4 font-medium">Status</th>
                <th scope="col" className="px-6 py-4 font-medium">Data Criação</th>
                <th scope="col" className="px-6 py-4 font-medium">Última Atividade</th>
                <th scope="col" className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
                        <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <p className="text-zinc-300 font-medium text-sm">Nenhum contato encontrado</p>
                      <p className="text-zinc-600 text-xs max-w-xs">Importe um arquivo CSV com seus contatos ou ajuste os filtros aplicados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-5">
                      <input
                        type="checkbox"
                        className="rounded border-white/10 bg-zinc-800 checked:bg-primary-500"
                        checked={selectedIds.has(contact.id)}
                        onChange={() => onToggleSelect(contact.id)}
                        aria-label={`Selecionar ${contact.name || contact.phone}`}
                      />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/10 text-white flex items-center justify-center font-bold text-xs shadow-inner" aria-hidden="true">
                          {(contact.name || contact.phone).substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground group-hover:text-primary-400 transition-colors">{contact.name || contact.phone}</p>
                          <p className="text-xs text-gray-500 font-mono">{contact.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex gap-1.5 flex-wrap">
                        {contact.tags.map((tag, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-zinc-800 text-gray-300 border border-white/5">
                            <Tag size={10} className="mr-1.5 opacity-50" aria-hidden="true" /> {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${contact.status === ContactStatus.OPT_IN ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        contact.status === ContactStatus.OPT_OUT ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        }`}>
                        {contact.status === ContactStatus.UNKNOWN ? 'DESCONHECIDO' : contact.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-gray-500 text-xs">
                      {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-5 text-gray-500 text-xs">
                      {contact.updatedAt
                        ? calculateRelativeTime(contact.updatedAt)
                        : (contact.createdAt ? calculateRelativeTime(contact.createdAt) : '-')}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditContact(contact)}
                          className="text-gray-500 hover:text-primary-400 p-1.5 rounded-lg hover:bg-primary-500/10 transition-colors"
                          aria-label={`Editar contato ${contact.name || contact.phone}`}
                        >
                          <Edit3 size={16} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => onDeleteClick(contact.id)}
                          className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                          aria-label={`Excluir contato ${contact.name || contact.phone}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                        ? 'bg-primary-500 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ADD CONTACT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Novo Contato</h2>
              <button onClick={() => setIsAddModalOpen(false)}><X className="text-gray-500 hover:text-white" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome Completo</label>
                <input
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary-500 outline-none transition-colors"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Ex: João Silva"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Telefone (WhatsApp) *</label>
                <input
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary-500 outline-none transition-colors"
                  placeholder="+55 11 99999-9999"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tags (separadas por vírgula)</label>
                <input
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary-500 outline-none transition-colors"
                  placeholder="VIP, Lead, Cliente"
                  value={newContact.tags}
                  onChange={(e) => setNewContact({ ...newContact, tags: e.target.value })}
                />
              </div>
              <div className="pt-4">
                <button
                  onClick={() => {
                    onAddContact(newContact);
                    setNewContact({ name: '', phone: '', tags: '' });
                  }}
                  className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Salvar Contato
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CONTACT MODAL */}
      {isEditModalOpen && editingContact && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Editar Contato</h2>
              <button onClick={() => setIsEditModalOpen(false)}><X className="text-gray-500 hover:text-white" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome Completo</label>
                <input
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary-500 outline-none transition-colors"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Telefone (WhatsApp) *</label>
                <input
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary-500 outline-none transition-colors"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tags (separadas por vírgula)</label>
                <input
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary-500 outline-none transition-colors"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Status</label>
                <select
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary-500 outline-none transition-colors"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ContactStatus })}
                >
                  <option value={ContactStatus.OPT_IN}>Opt-in</option>
                  <option value={ContactStatus.OPT_OUT}>Opt-out</option>
                  <option value={ContactStatus.UNKNOWN}>Desconhecido</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 bg-zinc-800 text-white font-medium py-3 rounded-xl hover:bg-zinc-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => onUpdateContact(editForm)}
                  className="flex-1 bg-primary-500 text-white font-bold py-3 rounded-xl hover:bg-primary-400 transition-colors"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && deleteTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Confirmar Exclusão</h2>
              <p className="text-gray-400 mb-6">
                {deleteTarget.type === 'single'
                  ? 'Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita.'
                  : `Tem certeza que deseja excluir ${selectedIds.size} contatos? Esta ação não pode ser desfeita.`
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onCancelDelete}
                  className="flex-1 bg-zinc-800 text-white font-medium py-3 rounded-xl hover:bg-zinc-700 transition-colors"
                  disabled={isDeleting}
                >
                  Cancelar
                </button>
                <button
                  onClick={onConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-400 transition-colors flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <><Loader2 size={18} className="animate-spin" /> Excluindo...</>
                  ) : (
                    <><Trash2 size={18} /> Excluir</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT CSV MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-2xl p-8 shadow-2xl animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Importar Contatos</h2>
                <p className="text-sm text-gray-400">Adicione múltiplos contatos de uma vez via CSV</p>
              </div>
              <button onClick={resetImport}><X className="text-gray-500 hover:text-white" /></button>
            </div>

            {/* Steps */}
            <div className="flex-1 overflow-y-auto px-1">

              {/* STEP 1: UPLOAD */}
              {importStep === 1 && (
                <div className="space-y-6">
                  <div
                    className="border-2 border-dashed border-zinc-800 hover:border-primary-500/50 hover:bg-white/5 rounded-2xl p-12 transition-all cursor-pointer text-center group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <UploadCloud size={32} className="text-gray-400 group-hover:text-primary-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Clique para selecionar ou arraste aqui</h3>
                    <p className="text-gray-500 text-sm">Suporta arquivos .csv (Máx 5MB)</p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".csv"
                      onChange={handleFileSelect}
                    />
                  </div>

                  <div className="bg-zinc-900/50 rounded-xl p-4 flex gap-3 border border-white/5">
                    <AlertCircle className="text-primary-500 flex-shrink-0" size={20} />
                    <div className="text-sm text-gray-400">
                      <p className="text-white font-medium mb-1">Dica de Formatação</p>
                      <p>Seu arquivo deve ter cabeçalhos na primeira linha (Ex: Nome, Telefone). O sistema tentará identificar as colunas automaticamente.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: MAPPING */}
              {importStep === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 bg-zinc-900 border border-white/10 p-3 rounded-lg mb-6">
                    <FileText size={20} className="text-primary-400" />
                    <span className="text-white text-sm font-medium flex-1 truncate">{csvFile?.name}</span>
                    <button onClick={resetImport} className="text-xs text-red-400 hover:underline">Trocar</button>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-white font-medium text-sm uppercase tracking-wider">Mapear Colunas</h3>

                      {/* Name Map */}
                      <div className="grid grid-cols-2 gap-4 items-center">
                        <label className="text-gray-400 text-sm">Nome do Contato</label>
                        <select
                          className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary-500"
                          value={columnMapping.name}
                          onChange={(e) => setColumnMapping({ ...columnMapping, name: e.target.value })}
                        >
                          <option value="">Ignorar coluna</option>
                          {csvPreview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      {/* Phone Map */}
                      <div className="grid grid-cols-2 gap-4 items-center">
                        <label className="text-gray-400 text-sm">Telefone / WhatsApp <span className="text-primary-500">*</span></label>
                        <select
                          className="bg-zinc-900 border border-primary-500/30 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary-500"
                          value={columnMapping.phone}
                          onChange={(e) => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                        >
                          <option value="">Selecione...</option>
                          {csvPreview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      {/* Tags Map */}
                      <div className="grid grid-cols-2 gap-4 items-center">
                        <label className="text-gray-400 text-sm">Coluna de Tags (se existir)</label>
                        <select
                          className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary-500"
                          value={columnMapping.tags}
                          onChange={(e) => setColumnMapping({ ...columnMapping, tags: e.target.value })}
                        >
                          <option value="">Nenhuma coluna de tags</option>
                          {csvPreview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      {/* Default Tag Input - shown when no tag column selected */}
                      {!columnMapping.tags && (
                        <div className="grid grid-cols-2 gap-4 items-center bg-primary-500/5 p-3 rounded-lg border border-primary-500/20">
                          <label className="text-gray-400 text-sm">
                            <span className="text-primary-400">✨</span> Tag padrão para todos
                          </label>
                          <input
                            type="text"
                            className="bg-zinc-900 border border-primary-500/30 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-primary-500"
                            placeholder="Ex: Importado, Lead"
                            value={columnMapping.defaultTag || ''}
                            onChange={(e) => setColumnMapping({ ...columnMapping, defaultTag: e.target.value })}
                          />
                        </div>
                      )}
                    </div>

                    {/* Preview Table */}
                    <div className="mt-4">
                      <h3 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">Pré-visualização dos dados (3 linhas)</h3>
                      <div className="overflow-hidden rounded-lg border border-white/10">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-white/5 text-gray-300">
                            <tr>
                              {csvPreview.headers.map(h => (
                                <th key={h} className={`px-3 py-2 font-medium ${Object.values(columnMapping).includes(h) ? 'text-primary-400 bg-primary-500/10' : ''
                                  }`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 bg-zinc-900/30">
                            {csvPreview.rows.map((row, i) => (
                              <tr key={i}>
                                {row.map((cell, j) => (
                                  <td key={j} className="px-3 py-2 text-gray-400 border-r border-white/5 last:border-0">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: SUCCESS */}
              {importStep === 3 && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500">
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Importação Concluída!</h3>
                  <p className="text-gray-400 mb-8">Seus contatos foram processados com sucesso.</p>

                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
                    <div className="bg-zinc-900 rounded-xl p-4">
                      <p className="text-2xl font-bold text-white">{importResult.total}</p>
                      <p className="text-xs text-gray-500">Linhas</p>
                    </div>
                    <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                      <p className="text-2xl font-bold text-emerald-400">{importResult.success}</p>
                      <p className="text-xs text-emerald-500/70">Sucessos</p>
                    </div>
                    <div className="bg-zinc-900 rounded-xl p-4">
                      <p className="text-2xl font-bold text-gray-400">{importResult.errors}</p>
                      <p className="text-xs text-gray-500">Ignorados</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-6 mt-6 border-t border-white/5 flex justify-end gap-3">
              {importStep === 1 && (
                <button onClick={resetImport} className="text-gray-400 hover:text-white px-4 py-2 text-sm font-medium">Cancelar</button>
              )}

              {importStep === 2 && (
                <>
                  <button onClick={resetImport} className="text-gray-400 hover:text-white px-4 py-2 text-sm font-medium" disabled={isImporting}>Cancelar</button>
                  <button
                    onClick={executeImport}
                    disabled={isImporting}
                    className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-primary-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImporting ? (
                      <><Loader2 size={18} className="animate-spin" /> Processando...</>
                    ) : (
                      <><CheckCircle2 size={18} /> Confirmar Importação</>
                    )}
                  </button>
                </>
              )}

              {importStep === 3 && (
                <button
                  onClick={resetImport}
                  className="bg-white text-black px-8 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                >
                  Fechar
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
