import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { templateService, UtilityCategory, GeneratedTemplate, GenerateUtilityParams } from '../services/templateService';
import { Template } from '../types';
import { useCurrentUser } from './useCurrentUser';

// Informações das categorias de utility para o UI
export const UTILITY_CATEGORIES: Record<UtilityCategory, { name: string; icon: string }> = {
  order_confirmation: { name: 'Confirmação de Pedido', icon: '📦' },
  shipping_update: { name: 'Atualização de Envio', icon: '🚚' },
  delivery_notification: { name: 'Notificação de Entrega', icon: '✅' },
  payment_reminder: { name: 'Lembrete de Pagamento', icon: '💳' },
  appointment_reminder: { name: 'Lembrete de Agendamento', icon: '📅' },
  account_update: { name: 'Atualização de Conta', icon: '👤' },
  ticket_status: { name: 'Status de Ticket', icon: '🎫' },
  subscription_update: { name: 'Atualização de Assinatura', icon: '🔄' },
  feedback_request: { name: 'Solicitação de Feedback', icon: '⭐' },
  verification_code: { name: 'Código de Verificação', icon: '🔐' },
  password_reset: { name: 'Recuperação de Senha', icon: '🔑' },
  security_alert: { name: 'Alerta de Segurança', icon: '🚨' },
  reservation_confirmation: { name: 'Confirmação de Reserva', icon: '🎟️' },
  service_completion: { name: 'Serviço Concluído', icon: '🛠️' },
  document_ready: { name: 'Documento Pronto', icon: '📄' },
};

export const useTemplatesController = () => {
  const queryClient = useQueryClient();
  const { activeOrgId } = useCurrentUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // AI Modal State (single template)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');

  // Details Modal State
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [templateDetails, setTemplateDetails] = useState<{
    header?: string | null;
    footer?: string | null;
    buttons?: Array<{ type: string; text: string; url?: string }>;
    qualityScore?: string | null;
    rejectedReason?: string | null;
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Delete confirmation state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

  // Multi-select state for bulk operations
  const [selectedMetaTemplates, setSelectedMetaTemplates] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Bulk Utility Generator State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkBusinessType, setBulkBusinessType] = useState('');
  const [bulkCategories, setBulkCategories] = useState<UtilityCategory[]>([]);
  const [bulkQuantity, setBulkQuantity] = useState(10);
  const [bulkLanguage, setBulkLanguage] = useState<'pt_BR' | 'en_US' | 'es_ES'>('pt_BR');
  const [generatedTemplates, setGeneratedTemplates] = useState<GeneratedTemplate[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [suggestedBatchName, setSuggestedBatchName] = useState<string>('');
  const [universalUrl, setUniversalUrl] = useState<string>('');
  const [universalPhone, setUniversalPhone] = useState<string>('');

  // --- Queries ---
  // Templates raramente mudam - cache infinito, sincroniza só no botão
  const templatesQuery = useQuery({
    queryKey: ['templates', activeOrgId],
    queryFn: templateService.getAll,
    staleTime: Infinity,  // Nunca considera "velho" automaticamente
    gcTime: Infinity,     // Nunca remove do cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Mostra erro de carregamento inicial como toast (React Query v5 removeu onError do useQuery)
  useEffect(() => {
    if (templatesQuery.error) {
      const msg = templatesQuery.error instanceof Error
        ? templatesQuery.error.message
        : 'Erro ao carregar templates. Verifique as configurações do WhatsApp.';
      toast.error(msg);
    }
  }, [templatesQuery.error]);

  // --- Mutations ---
  const syncMutation = useMutation({
    mutationFn: templateService.sync,
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['templates', activeOrgId] });
      toast.success(`${count} novo(s) template(s) sincronizado(s) do Meta Business Manager!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao sincronizar templates com a Meta');
    }
  });

  const generateAiMutation = useMutation({
    mutationFn: templateService.generateAiContent,
    onSuccess: (result) => {
      setAiResult(result);
    }
  });

  const addTemplateMutation = useMutation({
    mutationFn: templateService.add,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', activeOrgId] });
      setIsAiModalOpen(false);
      setAiPrompt('');
      setAiResult('');
      setNewTemplateName('');
    }
  });

  // Bulk Utility Generation Mutation
  const generateBulkMutation = useMutation({
    mutationFn: (params: GenerateUtilityParams) => templateService.generateUtilityTemplates(params),
    onSuccess: (result) => {
      setGeneratedTemplates(result.templates);
      setSelectedTemplates(new Set(result.templates.map(t => t.id)));
      setSuggestedBatchName(result.metadata.suggestedTitle || 'Submissão em Lote');
      toast.success(`${result.templates.length} templates gerados com sucesso!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao gerar templates');
    }
  });

  // Delete Template Mutation
  const deleteMutation = useMutation({
    mutationFn: (name: string) => templateService.delete(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['templates', activeOrgId] });
      toast.success(`Template "${name}" deletado com sucesso!`);
      setIsDeleteModalOpen(false);
      setTemplateToDelete(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao deletar template');
    }
  });

  // Bulk Delete Mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (names: string[]) => templateService.deleteBulk(names),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['templates', activeOrgId] });
      if (result.deleted > 0) {
        toast.success(`${result.deleted} template(s) deletado(s) com sucesso!`);
      }
      if (result.failed > 0) {
        result.errors.forEach(err => {
          toast.error(`${err.name}: ${err.error}`);
        });
      }
      setIsBulkDeleteModalOpen(false);
      setSelectedMetaTemplates(new Set());
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao deletar templates');
    }
  });

  // --- Logic ---
  const filteredTemplates = useMemo(() => {
    if (!templatesQuery.data) return [];
    return templatesQuery.data.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'ALL' || t.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [templatesQuery.data, searchTerm, categoryFilter]);

  const handleGenerateAI = () => {
    if (!aiPrompt) return;
    generateAiMutation.mutate(aiPrompt);
  };

  const handleSaveAiTemplate = () => {
    if (!aiResult || !newTemplateName) {
      toast.error('Por favor defina um nome e gere o conteúdo.');
      return;
    }

    addTemplateMutation.mutate({
      name: newTemplateName,
      category: 'MARKETING', // Default for AI
      language: 'pt_BR',
      content: aiResult
    });
  };

  // Bulk Utility Handlers - SIMPLIFICADO
  const handleGenerateBulk = () => {
    if (!bulkBusinessType.trim() || bulkBusinessType.length < 10) {
      toast.error('Descreva melhor o que você precisa (mínimo 10 caracteres)');
      return;
    }

    generateBulkMutation.mutate({
      prompt: bulkBusinessType,
      quantity: bulkQuantity,
      language: bulkLanguage
    });
  };

  const handleToggleCategory = (category: UtilityCategory) => {
    setBulkCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleToggleTemplate = (id: string) => {
    setSelectedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllTemplates = () => {
    if (selectedTemplates.size === generatedTemplates.length) {
      setSelectedTemplates(new Set());
    } else {
      setSelectedTemplates(new Set(generatedTemplates.map(t => t.id)));
    }
  };

  const handleCopyTemplate = (template: GeneratedTemplate) => {
    navigator.clipboard.writeText(template.content);
    toast.success('Template copiado!');
  };

  // Estado para criação na Meta
  const [isCreatingInMeta, setIsCreatingInMeta] = useState(false);

  const handleExportSelected = async () => {
    const selected = generatedTemplates.filter(t => selectedTemplates.has(t.id));

    if (selected.length === 0) {
      toast.error('Selecione pelo menos um template');
      return;
    }

    setIsCreatingInMeta(true);

    try {
      const templatesToCreate = selected.map(t => ({
        name: t.name,
        content: t.content,
        language: t.language,
        category: 'UTILITY' as const,
        // Incluir variáveis de exemplo se existirem
        ...(t.variables && t.variables.length > 0 && { exampleVariables: t.variables.map((v, i) => `Exemplo ${i + 1}`) }),
        // Incluir header, footer e buttons se existirem
        ...(t.header && { header: t.header }),
        ...(t.footer && { footer: t.footer }),
        ...(t.buttons && t.buttons.length > 0 && { buttons: t.buttons }),
      }));

      const result = await templateService.createBulkInMeta(templatesToCreate);

      if (result.created > 0) {
        toast.success(`${result.created} template(s) criado(s) na Meta!`);
        // Invalida cache para recarregar lista
        queryClient.invalidateQueries({ queryKey: ['templates', activeOrgId] });
      }

      if (result.failed > 0) {
        result.errors.forEach(err => {
          toast.error(`${err.name}: ${err.error}`);
        });
      }

      // Fecha modal se todos criados com sucesso
      if (result.failed === 0) {
        handleCloseBulkModal();
      }

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar templates');
    } finally {
      setIsCreatingInMeta(false);
    }
  };

  const handleCloseBulkModal = () => {
    setIsBulkModalOpen(false);
    setBulkBusinessType('');
    setBulkCategories([]);
    setBulkQuantity(5);
    setGeneratedTemplates([]);
    setSelectedTemplates(new Set());
  };

  // --- Details Modal Handlers ---
  const handleViewDetails = async (template: Template) => {
    setSelectedTemplate(template);
    setIsDetailsModalOpen(true);
    setIsLoadingDetails(true);
    setTemplateDetails(null);

    try {
      const details = await templateService.getByName(template.name);
      setTemplateDetails({
        header: details.header,
        footer: details.footer,
        buttons: details.buttons,
        qualityScore: details.qualityScore,
        rejectedReason: details.rejectedReason
      });
    } catch (error) {
      console.error('Error loading details:', error);
      // Ainda mostra o modal com os dados básicos
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCloseDetails = () => {
    setIsDetailsModalOpen(false);
    setSelectedTemplate(null);
    setTemplateDetails(null);
  };

  // --- Delete Handlers ---
  const handleDeleteClick = (template: Template) => {
    setTemplateToDelete(template);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (templateToDelete) {
      deleteMutation.mutate(templateToDelete.name);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setTemplateToDelete(null);
  };

  // --- Multi-select Handlers for Meta Templates ---
  const handleToggleMetaTemplate = (templateName: string) => {
    setSelectedMetaTemplates(prev => {
      const next = new Set(prev);
      if (next.has(templateName)) {
        next.delete(templateName);
      } else {
        next.add(templateName);
      }
      return next;
    });
  };

  const handleSelectAllMetaTemplates = () => {
    if (selectedMetaTemplates.size === filteredTemplates.length) {
      setSelectedMetaTemplates(new Set());
    } else {
      setSelectedMetaTemplates(new Set(filteredTemplates.map(t => t.name)));
    }
  };

  const handleClearSelection = () => {
    setSelectedMetaTemplates(new Set());
  };

  const handleBulkDeleteClick = () => {
    if (selectedMetaTemplates.size === 0) {
      toast.error('Selecione pelo menos um template');
      return;
    }
    setIsBulkDeleteModalOpen(true);
  };

  const handleConfirmBulkDelete = () => {
    const names = Array.from(selectedMetaTemplates);
    bulkDeleteMutation.mutate(names);
  };

  const handleCancelBulkDelete = () => {
    setIsBulkDeleteModalOpen(false);
  };

  return {
    templates: filteredTemplates,
    isLoading: templatesQuery.isLoading,
    isSyncing: syncMutation.isPending,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    onSync: () => syncMutation.mutate(),

    // AI Modal Props
    isAiModalOpen,
    setIsAiModalOpen,
    aiPrompt,
    setAiPrompt,
    aiResult,
    isAiGenerating: generateAiMutation.isPending,
    onGenerateAi: handleGenerateAI,
    newTemplateName,
    setNewTemplateName,
    onSaveAiTemplate: handleSaveAiTemplate,
    isSaving: addTemplateMutation.isPending,

    // Bulk Utility Generator Props
    isBulkModalOpen,
    setIsBulkModalOpen,
    bulkBusinessType,
    setBulkBusinessType,
    bulkCategories,
    bulkQuantity,
    setBulkQuantity,
    bulkLanguage,
    setBulkLanguage,
    generatedTemplates,
    selectedTemplates,
    suggestedBatchName,
    universalUrl,
    setUniversalUrl,
    universalPhone,
    setUniversalPhone,
    isBulkGenerating: generateBulkMutation.isPending,
    isCreatingInMeta,
    onGenerateBulk: handleGenerateBulk,
    onToggleCategory: handleToggleCategory,
    onToggleTemplate: handleToggleTemplate,
    onSelectAllTemplates: handleSelectAllTemplates,
    onCopyTemplate: handleCopyTemplate,
    onExportSelected: handleExportSelected,
    onCloseBulkModal: handleCloseBulkModal,

    // Details Modal Props
    selectedTemplate,
    isDetailsModalOpen,
    templateDetails,
    isLoadingDetails,
    onViewDetails: handleViewDetails,
    onCloseDetails: handleCloseDetails,

    // Delete Modal Props
    isDeleteModalOpen,
    templateToDelete,
    isDeleting: deleteMutation.isPending,
    onDeleteClick: handleDeleteClick,
    onConfirmDelete: handleConfirmDelete,
    onCancelDelete: handleCancelDelete,

    // Multi-select & Bulk Delete Props
    selectedMetaTemplates,
    onToggleMetaTemplate: handleToggleMetaTemplate,
    onSelectAllMetaTemplates: handleSelectAllMetaTemplates,
    onClearSelection: handleClearSelection,
    isBulkDeleteModalOpen,
    isBulkDeleting: bulkDeleteMutation.isPending,
    onBulkDeleteClick: handleBulkDeleteClick,
    onConfirmBulkDelete: handleConfirmBulkDelete,
    onCancelBulkDelete: handleCancelBulkDelete,
  };
};
