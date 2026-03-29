import { useState, useMemo } from 'react';
import { useCurrentUser } from './useCurrentUser'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { contactService } from '../services';
import { Contact, ContactStatus } from '../types';

const ITEMS_PER_PAGE = 10;

export const useContactsController = () => {
  const queryClient = useQueryClient();

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'ALL'>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk'; id?: string } | null>(null);

  // Import State
  const [importReport, setImportReport] = useState<string | null>(null);

  // --- Queries ---
  const contactsQuery = useQuery({
    queryKey: ['contacts', useCurrentUser().activeOrgId ?? 'default'],
    queryFn: contactService.getAll,
    staleTime: 30 * 1000,  // 30 segundos
    select: (data) => {
      const normalized: Record<string, Contact> = {};
      data.forEach(c => normalized[c.id] = c);
      return { list: data, byId: normalized };
    }
  });

  const statsQuery = useQuery({
    queryKey: ['contactStats'],
    queryFn: contactService.getStats,
    staleTime: 60 * 1000,  // 60 segundos
    initialData: { total: 0, optIn: 0, optOut: 0 }
  });

  const tagsQuery = useQuery({
    queryKey: ['contactTags'],
    queryFn: contactService.getTags,
    staleTime: 60 * 1000,  // 60 segundos
    initialData: []
  });

  // --- Mutations ---
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['contactStats'] });
    queryClient.invalidateQueries({ queryKey: ['contactTags'] });
  };

  const addMutation = useMutation({
    mutationFn: contactService.add,
    onSuccess: () => {
      invalidateAll();
      setIsAddModalOpen(false);
      toast.success('Contato adicionado com sucesso!');
    },
    onError: (error) => toast.error(error.message || 'Erro ao adicionar contato')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Contact, 'id'>> }) =>
      contactService.update(id, data),
    onSuccess: () => {
      invalidateAll();
      setIsEditModalOpen(false);
      setEditingContact(null);
      toast.success('Contato atualizado com sucesso!');
    },
    onError: (error) => toast.error(error.message || 'Erro ao atualizar contato')
  });

  const deleteMutation = useMutation({
    mutationFn: contactService.delete,
    onSuccess: () => {
      invalidateAll();
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      toast.success('Contato excluído com sucesso!');
    },
    onError: (error) => toast.error(error.message || 'Erro ao excluir contato')
  });

  const deleteManyMutation = useMutation({
    mutationFn: contactService.deleteMany,
    onSuccess: (count) => {
      invalidateAll();
      setSelectedIds(new Set());
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      toast.success(`${count} contatos excluídos com sucesso!`);
    },
    onError: (error) => toast.error(error.message || 'Erro ao excluir contatos')
  });

  const importMutation = useMutation({
    mutationFn: contactService.import,
    onSuccess: (count) => {
      invalidateAll();
      toast.success(`${count} contatos importados com sucesso!`);
    },
    onError: () => toast.error('Erro ao importar contatos')
  });

  // New: Import from file with validation report
  const importFromFileMutation = useMutation({
    mutationFn: (file: File) => contactService.importFromFile(file),
    onSuccess: (result) => {
      invalidateAll();
      setImportReport(result.report);
      if (result.imported > 0) {
        toast.success(`${result.imported} contatos importados!`);
      }
      if (result.failed > 0) {
        toast.warning(`${result.failed} contatos inválidos (ver relatório)`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao importar contatos');
    }
  });

  // --- Filtering & Pagination Logic ---
  const filteredContacts = useMemo(() => {
    if (!contactsQuery.data?.list) return [];

    return contactsQuery.data.list.filter(c => {
      // Search filter
      const matchesSearch =
        (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm);

      // Status filter
      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;

      // Tag filter
      const matchesTag = tagFilter === 'ALL' || c.tags.includes(tagFilter);

      return matchesSearch && matchesStatus && matchesTag;
    });
  }, [contactsQuery.data, searchTerm, statusFilter, tagFilter]);

  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredContacts.slice(start, end);
  }, [filteredContacts, currentPage]);

  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);

  // Reset page when filters change
  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (status: ContactStatus | 'ALL') => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleTagFilterChange = (tag: string) => {
    setTagFilter(tag);
    setCurrentPage(1);
  };

  // --- Selection Logic ---
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedContacts.map(c => c.id)));
    }
  };

  const isAllSelected = paginatedContacts.length > 0 && selectedIds.size === paginatedContacts.length;
  const isSomeSelected = selectedIds.size > 0;

  // --- Handlers ---
  const handleAddContact = (contact: { name: string; phone: string; tags: string }) => {
    if (!contact.phone) {
      toast.error('Telefone é obrigatório');
      return;
    }

    // Validate phone before submitting
    const validation = contactService.validatePhone(contact.phone);
    if (!validation.isValid) {
      toast.error(validation.error || 'Número de telefone inválido');
      return;
    }

    addMutation.mutate({
      name: contact.name || 'Desconhecido',
      phone: contact.phone,
      status: ContactStatus.OPT_IN,
      tags: contact.tags.split(',').map(t => t.trim()).filter(t => t)
    });
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setIsEditModalOpen(true);
  };

  const handleUpdateContact = (data: { name: string; phone: string; tags: string; status: ContactStatus }) => {
    if (!editingContact) return;
    updateMutation.mutate({
      id: editingContact.id,
      data: {
        name: data.name,
        phone: data.phone,
        status: data.status,
        tags: data.tags.split(',').map(t => t.trim()).filter(t => t)
      }
    });
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTarget({ type: 'single', id });
    setIsDeleteModalOpen(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget({ type: 'bulk' });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'single' && deleteTarget.id) {
      deleteMutation.mutate(deleteTarget.id);
    } else if (deleteTarget.type === 'bulk') {
      deleteManyMutation.mutate(Array.from(selectedIds));
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
  };

  return {
    // Data
    contacts: paginatedContacts,
    allFilteredContacts: filteredContacts,
    stats: statsQuery.data,
    tags: tagsQuery.data,
    isLoading: contactsQuery.isLoading || statsQuery.isLoading,

    // Filters
    searchTerm,
    setSearchTerm: handleSearchChange,
    statusFilter,
    setStatusFilter: handleStatusFilterChange,
    tagFilter,
    setTagFilter: handleTagFilterChange,

    // Pagination
    currentPage,
    setCurrentPage,
    totalPages,
    totalFiltered: filteredContacts.length,
    itemsPerPage: ITEMS_PER_PAGE,

    // Selection
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    isAllSelected,
    isSomeSelected,

    // Modals
    isAddModalOpen,
    setIsAddModalOpen,
    isImportModalOpen,
    setIsImportModalOpen,
    isEditModalOpen,
    setIsEditModalOpen,
    isDeleteModalOpen,
    editingContact,
    deleteTarget,

    // Actions
    onAddContact: handleAddContact,
    onEditContact: handleEditContact,
    onUpdateContact: handleUpdateContact,
    onDeleteClick: handleDeleteClick,
    onBulkDeleteClick: handleBulkDeleteClick,
    onConfirmDelete: handleConfirmDelete,
    onCancelDelete: handleCancelDelete,
    onImport: importMutation.mutateAsync,
    onImportFile: importFromFileMutation.mutateAsync,
    isImporting: importMutation.isPending || importFromFileMutation.isPending,
    isDeleting: deleteMutation.isPending || deleteManyMutation.isPending,

    // Import report
    importReport,
    clearImportReport: () => setImportReport(null),
  };
};
