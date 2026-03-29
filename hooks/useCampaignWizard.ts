import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@/lib/navigation';
import { toast } from 'sonner';
import { campaignService, contactService, templateService } from '../services';
import { settingsService } from '../services/settingsService';
import { Template, TestContact } from '../types';
import { useAccountLimits } from './useAccountLimits';
import { CampaignValidation } from '../lib/meta-limits';
import { countTemplateVariables } from '../lib/template-validator';
import { AntiBanConfig, DEFAULT_ANTI_BAN } from '../components/features/campaigns/AntiBanSettings';

export const useCampaignWizardController = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);

  // Form State
  const [name, setName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [additionalTemplateIds, setAdditionalTemplateIds] = useState<string[]>([]); // Extra templates for rotation

  // Anti-ban config for Evolution API campaigns
  const [antiBanConfig, setAntiBanConfig] = useState<AntiBanConfig>(DEFAULT_ANTI_BAN);
  const [providerType, setProviderType] = useState<'meta' | 'evolution'>('meta');
  const [recipientSource, setRecipientSource] = useState<'all' | 'specific' | 'test' | 'excel' | null>(null);
  const [excelContacts, setExcelContacts] = useState<{ name: string; phone: string }[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  
  // Template Variables State - for {{2}}, {{3}}, etc. ({{1}} is always the contact name)
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  
  // Scheduling State
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  // Validation Modal State
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [validationResult, setValidationResult] = useState<CampaignValidation | null>(null);

  // Account Limits Hook
  const { validate, limits, isLoading: limitsLoading, tierName } = useAccountLimits();

  // --- Queries ---
  const contactsQuery = useQuery({
    queryKey: ['contacts'],
    queryFn: contactService.getAll,
  });

  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: templateService.getAll,
    select: (data) => data.filter(t => t.status === 'APPROVED')
  });

  // Get settings for test contact
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.get,
  });

  const testContact = settingsQuery.data?.testContact;

  // Initialize name
  useEffect(() => {
    if (!name) {
      const date = new Date().toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
      setName(`Campanha ${date}`);
    }
  }, []);

  // Update selected contact IDs when switching to "all"
  useEffect(() => {
    if (recipientSource === 'all' && contactsQuery.data) {
      setSelectedContactIds(contactsQuery.data.map(c => c.id));
    } else if (recipientSource === 'specific') {
      setSelectedContactIds([]);
    } else if (recipientSource === 'test') {
      // Test mode doesn't use contact IDs - handled separately
      setSelectedContactIds([]);
    } else if (recipientSource === 'excel') {
      setSelectedContactIds([]);
    }
  }, [recipientSource, contactsQuery.data]);

  // --- Mutations ---
  const createCampaignMutation = useMutation({
    mutationFn: campaignService.create,
    onMutate: async (input) => {
      // Generate temp ID for immediate navigation
      const tempId = `temp_${Date.now()}`;
      
      // 🚀 PRE-SET cache with PENDING messages BEFORE API call
      const contacts = input.selectedContacts || [];
      const pendingMessages = contacts.map((contact, index) => ({
        id: `msg_${tempId}_${index}`,
        campaignId: tempId,
        contactName: contact.name || contact.phone,
        contactPhone: contact.phone,
        status: 'Pending' as const,
        sentAt: '-',
      }));
      
      // Pre-populate the campaign in cache
      const pendingCampaign = {
        id: tempId,
        name: input.name,
        template: input.templateName,
        recipients: input.recipients,
        sent: 0,
        status: 'SENDING' as const,
        createdAt: new Date().toISOString(),
      };
      
      queryClient.setQueryData(['campaign', tempId], pendingCampaign);
      queryClient.setQueryData(['campaignMessages', tempId], pendingMessages);
      
      // Navigate IMMEDIATELY (before API responds)
      navigate(`/campaigns/${tempId}`);
      
      return { tempId };
    },
    onSuccess: (campaign, _input, context) => {
      const tempId = context?.tempId;
      
      // Copy cached data to real campaign ID
      if (tempId) {
        const cachedMessages = queryClient.getQueryData(['campaignMessages', tempId]);
        if (cachedMessages) {
          queryClient.setQueryData(['campaignMessages', campaign.id], cachedMessages);
        }
        // Clean up temp cache
        queryClient.removeQueries({ queryKey: ['campaign', tempId] });
        queryClient.removeQueries({ queryKey: ['campaignMessages', tempId] });
      }
      
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      
      // Navigate to real campaign (replaces temp URL)
      navigate(`/campaigns/${campaign.id}`, { replace: true });
      
      toast.success('Campanha criada e disparada com sucesso!');
    },
    onError: (_error, _input, context) => {
      // Clean up temp cache on error
      if (context?.tempId) {
        queryClient.removeQueries({ queryKey: ['campaign', context.tempId] });
        queryClient.removeQueries({ queryKey: ['campaignMessages', context.tempId] });
      }
      toast.error('Erro ao criar campanha.');
      navigate('/campaigns');
    }
  });

  // --- Logic ---
  const allContacts = contactsQuery.data || [];
  const totalContacts = allContacts.length;
  const selectedContacts = allContacts.filter(c => selectedContactIds.includes(c.id));
  
  // Calculate recipient count - 1 for test mode, otherwise selected contacts
  const recipientCount = recipientSource === 'test' && testContact ? 1 : recipientSource === 'excel' ? excelContacts.length : selectedContacts.length;
  
  // Get contacts for sending - test contact or selected contacts
  const contactsForSending = recipientSource === 'test' && testContact 
    ? [{ name: testContact.name || testContact.phone, phone: testContact.phone }]
    : recipientSource === 'excel'
      ? excelContacts
      : selectedContacts.map(c => ({ name: c.name || c.phone, phone: c.phone }));
  
  const availableTemplates = templatesQuery.data || [];
  const selectedTemplate = availableTemplates.find(t => t.id === selectedTemplateId);
  const additionalTemplates = additionalTemplateIds.map(id => availableTemplates.find(t => t.id === id)).filter(Boolean) as typeof availableTemplates;
  const allSelectedTemplateNames: string[] = [
    ...(selectedTemplate ? [selectedTemplate.name] : []),
    ...additionalTemplates.map(t => t.name),
  ];
  
  // Calculate all template variables with detailed info about where each is used
  const templateVariableInfo = useMemo(() => {
    if (!selectedTemplate) return { body: [], header: [], buttons: [], totalExtra: 0 };
    
    const components = selectedTemplate.components || [];
    const result = {
      body: [] as { index: number; placeholder: string; context: string }[],
      header: [] as { index: number; placeholder: string; context: string }[],
      buttons: [] as { index: number; buttonIndex: number; buttonText: string; context: string }[],
      totalExtra: 0,
    };
    
    // Parse body variables
    const bodyComponent = components.find(c => c.type === 'BODY');
    if (bodyComponent?.text) {
      const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g) || [];
      matches.forEach((match, idx) => {
        const varNum = parseInt(match.replace(/[{}]/g, ''));
        if (varNum === 1) {
          // {{1}} is always the contact name - automatic
          result.body.push({ 
            index: varNum, 
            placeholder: match, 
            context: 'Nome do contato (automático)' 
          });
        } else {
          // {{2}}, {{3}}, etc. need user input
          result.body.push({ 
            index: varNum, 
            placeholder: match, 
            context: `Variável ${varNum} do texto` 
          });
          result.totalExtra++;
        }
      });
    }
    
    // Parse header variables (text headers only)
    const headerComponent = components.find(c => c.type === 'HEADER');
    if (headerComponent?.format === 'TEXT' && headerComponent?.text) {
      const matches = headerComponent.text.match(/\{\{(\d+)\}\}/g) || [];
      matches.forEach((match) => {
        const varNum = parseInt(match.replace(/[{}]/g, ''));
        result.header.push({ 
          index: varNum, 
          placeholder: match, 
          context: 'Variável do cabeçalho' 
        });
        result.totalExtra++;
      });
    }
    
    // Parse button URL variables
    const buttonsComponent = components.find(c => c.type === 'BUTTONS');
    if (buttonsComponent?.buttons) {
      buttonsComponent.buttons.forEach((button, btnIdx) => {
        if (button.type === 'URL' && button.url?.includes('{{')) {
          const matches = button.url.match(/\{\{(\d+)\}\}/g) || [];
          matches.forEach((match) => {
            const varNum = parseInt(match.replace(/[{}]/g, ''));
            result.buttons.push({
              index: varNum,
              buttonIndex: btnIdx,
              buttonText: button.text,
              context: `URL dinâmica do botão "${button.text}"`
            });
            result.totalExtra++;
          });
        }
      });
    }
    
    return result;
  }, [selectedTemplate]);
  
  // For backward compatibility - count of extra variables (excluding {{1}} = contact name)
  const templateVariableCount = templateVariableInfo.totalExtra;
  
  // Reset template variables when template changes
  useEffect(() => {
    setTemplateVariables(Array(templateVariableCount).fill(''));
  }, [templateVariableCount]);

  // 🔴 LIVE VALIDATION - Check limits in real-time as user selects contacts
  const liveValidation = useMemo(() => {
    if (recipientCount === 0) return null;
    return validate(recipientCount);
  }, [recipientCount, validate]);

  const isOverLimit = liveValidation ? !liveValidation.canSend : false;
  // Use the limit from validation (respects DEBUG mode) not from API limits
  const currentLimit = liveValidation?.currentLimit || limits?.maxUniqueUsersPerDay || 250;

  const toggleContact = (contactId: string) => {
    setSelectedContactIds(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleNext = () => {
    if (step === 1) {
      if (!name) { toast.error('Por favor insira o nome da campanha'); return; }
      if (!selectedTemplateId) { toast.error('Por favor selecione um template'); return; }
    }
    if (step === 2) {
      if (!recipientSource) { toast.error('Por favor selecione uma fonte de destinatários'); return; }
      if (recipientSource === 'specific' && selectedContactIds.length === 0) {
        toast.error('Por favor selecione pelo menos um contato');
        return;
      }
      if (recipientSource === 'excel' && excelContacts.length === 0) {
        toast.error('Por favor importe um arquivo com contatos válidos');
        return;
      }
      if (recipientSource === 'test' && !testContact) {
        toast.error('Contato de teste não configurado. Configure em Ajustes.');
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => setStep((prev) => Math.max(prev - 1, 1));

  // INTELLIGENT VALIDATION - Prevents users from sending campaigns that exceed limits
  const handleSend = (scheduleTime?: string) => {
    // Validate that all required template variables are filled
    if (templateVariableCount > 0) {
      const emptyVars = templateVariables.filter(v => !v || v.trim() === '');
      if (emptyVars.length > 0) {
        toast.error(`Preencha todas as variáveis do template (${emptyVars.length} pendentes)`);
        return;
      }
    }
    
    // Validate campaign against account limits
    const validation = validate(recipientCount);
    setValidationResult(validation);
    
    // If campaign is blocked, show modal with explanation
    if (!validation.canSend) {
      setShowBlockModal(true);
      return;
    }
    
    // Show warnings if any (but allow to proceed)
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => {
        toast.warning(warning);
      });
    }
    
    // Proceed with campaign creation
    createCampaignMutation.mutate({
      name: recipientSource === 'test' ? `[TESTE] ${name}` : name,
      templateName: selectedTemplate?.name || 'unknown_template',
      recipients: recipientCount,
      selectedContacts: contactsForSending,
      selectedContactIds: recipientSource === 'test' ? [] : selectedContactIds, // Save for resume functionality
      scheduledAt: scheduleTime || scheduledAt || undefined, // Use provided time or state
      templateVariables: templateVariables.length > 0 ? templateVariables : undefined,
      providerType: providerType,
      delayMinMs: antiBanConfig.delayMinMs,
      delayMaxMs: antiBanConfig.delayMaxMs,
      simulateTyping: antiBanConfig.simulateTyping,
      dailyLimit: antiBanConfig.dailyLimit,
      messageVariants: antiBanConfig.messageVariants.length > 0 ? antiBanConfig.messageVariants : undefined,
    });
  };
  
  // Schedule campaign for later
  const handleSchedule = (scheduleTime: string) => {
    setScheduledAt(scheduleTime);
    handleSend(scheduleTime);
  };

  // Close the block modal
  const closeBlockModal = () => {
    setShowBlockModal(false);
    setValidationResult(null);
  };

  return {
    step,
    setStep,
    name,
    setName,
    selectedTemplateId,
    setSelectedTemplateId,
    additionalTemplateIds,
    setAdditionalTemplateIds,
    additionalTemplates,
    allSelectedTemplateNames,
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
    antiBanConfig,
    setAntiBanConfig,
    providerType,
    setProviderType,
    isCreating: createCampaignMutation.isPending,
    isLoading: contactsQuery.isLoading || templatesQuery.isLoading || limitsLoading || settingsQuery.isLoading,
    
    // Test Contact
    testContact,
    
    // Template Variables (for {{2}}, {{3}}, etc.)
    templateVariables,
    setTemplateVariables,
    templateVariableCount,
    templateVariableInfo, // Detailed info about each variable location
    
    // Account Limits & Validation state
    accountLimits: limits,
    isBlockModalOpen: showBlockModal,
    setIsBlockModalOpen: setShowBlockModal,
    blockReason: validationResult,
    tierName,
    
    // Live validation (real-time as user selects)
    liveValidation,
    isOverLimit,
    currentLimit,
    
    // Scheduling
    scheduledAt,
    setScheduledAt,
    isScheduling,
    setIsScheduling,
    handleSchedule,
  };
};
