import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { settingsService } from '../services/settingsService';
import { AppSettings } from '../types';
import { useAccountLimits } from './useAccountLimits';
import {
  checkAccountHealth,
  quickHealthCheck,
  getHealthSummary,
  type AccountHealth
} from '../lib/account-health';
import { Database, Zap, MessageSquare, Bot } from 'lucide-react';
import React from 'react';
import { SetupStep } from '../components/features/settings/SetupWizardView';

interface WebhookInfo {
  webhookUrl: string;
  webhookToken: string;
  stats: {
    lastEventAt: string | null;
    todayDelivered: number;
    todayRead: number;
    todayFailed: number;
  } | null;
}

// System health status
interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    redis: {
      status: 'ok' | 'error' | 'not_configured';
      latency?: number;
      message?: string;
    };
    qstash: {
      status: 'ok' | 'error' | 'not_configured';
      message?: string;
    };
    whatsapp: {
      status: 'ok' | 'error' | 'not_configured';
      source?: 'redis' | 'env' | 'none';
      phoneNumber?: string;
      message?: string;
    };
  };
  // Vercel project info for dynamic linking
  vercel?: {
    dashboardUrl: string | null;
    storesUrl: string | null;
    env: string;
  };
  timestamp: string;
}

// Phone number from Meta API
export interface PhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  webhook_configuration?: {
    phone_number?: string;
    whatsapp_business_account?: string;
    application?: string;
  };
}

// Domain option for webhook URL selection
export interface DomainOption {
  url: string;
  source: string;
  recommended: boolean;
}

export const useSettingsController = () => {
  const queryClient = useQueryClient();

  // Account limits (tier, quality, etc.)
  const {
    limits: accountLimits,
    refreshLimits,
    tierName,
    isError: limitsError,
    errorMessage: limitsErrorMessage,
    isLoading: limitsLoading,
    hasLimits
  } = useAccountLimits();

  // Local state for form
  const [formSettings, setFormSettings] = useState<AppSettings>({
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    isConnected: false
  });

  // Account Health State
  const [accountHealth, setAccountHealth] = useState<AccountHealth | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // --- Queries ---
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.get,
  });

  // Webhook info query
  const webhookQuery = useQuery({
    queryKey: ['webhookInfo'],
    queryFn: async (): Promise<WebhookInfo> => {
      const response = await fetch('/api/webhook/info');
      if (!response.ok) throw new Error('Failed to fetch webhook info');
      return response.json();
    },
    enabled: !!settingsQuery.data?.isConnected, // Only fetch when connected
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  // Phone numbers query (for webhook override management)
  // Uses credentials from Redis - no need to pass from frontend
  const phoneNumbersQuery = useQuery({
    queryKey: ['phoneNumbers'],
    queryFn: async (): Promise<PhoneNumber[]> => {
      const response = await fetch('/api/phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Empty body - backend uses Redis credentials
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch phone numbers');
      }
      return response.json();
    },
    enabled: !!settingsQuery.data?.isConnected,
    staleTime: 60 * 1000, // Cache for 1 minute
    retry: false, // Don't retry on auth errors
  });

  // AI Settings Query
  const aiSettingsQuery = useQuery({
    queryKey: ['aiSettings'],
    queryFn: settingsService.getAIConfig,
    staleTime: 60 * 1000,
  });

  // Test Contact Query - persisted in Supabase
  const testContactQuery = useQuery({
    queryKey: ['testContact'],
    queryFn: settingsService.getTestContact,
    staleTime: 60 * 1000,
  });

  // Available domains query (auto-detect from Vercel)
  const domainsQuery = useQuery({
    queryKey: ['availableDomains'],
    queryFn: async (): Promise<{ domains: DomainOption[]; webhookPath: string; currentSelection: string | null }> => {
      const response = await fetch('/api/settings/domains');
      if (!response.ok) throw new Error('Failed to fetch domains');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // System status query (consolidated: health + usage + vercel info)
  const systemQuery = useQuery({
    queryKey: ['systemStatus'],
    queryFn: async () => {
      const response = await fetch('/api/system');
      if (!response.ok) throw new Error('Failed to fetch system status');
      return response.json();
    },
    staleTime: 60 * 1000, // Cache for 1 minute
    // No polling - user can manually refresh if needed
  });

  // Backward compatible healthQuery accessor
  const healthQuery = {
    data: systemQuery.data?.health ? {
      ...systemQuery.data.health,
      vercel: systemQuery.data.vercel,
      timestamp: systemQuery.data.timestamp,
    } : undefined,
    isLoading: systemQuery.isLoading,
  };

  // Sync form with data when loaded
  useEffect(() => {
    if (settingsQuery.data) {
      setFormSettings(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: settingsService.save,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      toast.success('Configuração salva com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao salvar configuração.');
    }
  });

  const saveAIMutation = useMutation({
    mutationFn: settingsService.saveAIConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
      toast.success('Configuração de IA salva com sucesso!');
    },
    // Error is handled inline in the component
  });

  const removeAIMutation = useMutation({
    mutationFn: settingsService.removeAIKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
    },
    onError: () => {
      toast.error('Erro ao remover chave de IA.');
    }
  });

  // Test Contact Mutations - Supabase
  const saveTestContactMutation = useMutation({
    mutationFn: settingsService.saveTestContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testContact'] });
      toast.success('Contato de teste salvo!');
    },
    onError: () => {
      toast.error('Erro ao salvar contato de teste.');
    }
  });

  const removeTestContactMutation = useMutation({
    mutationFn: settingsService.removeTestContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testContact'] });
      toast.success('Contato de teste removido!');
    },
    onError: () => {
      toast.error('Erro ao remover contato de teste.');
    }
  });

  const handleSave = async () => {
    // 1. Optimistic Update
    const pendingSettings = { ...formSettings, isConnected: true };

    try {
      // 2. Fetch Real Data from Meta
      const metaData = await settingsService.fetchPhoneDetails({
        phoneNumberId: formSettings.phoneNumberId,
        accessToken: formSettings.accessToken
      });

      // 3. Merge Data
      const finalSettings = {
        ...pendingSettings,
        displayPhoneNumber: metaData.display_phone_number,
        qualityRating: metaData.quality_rating,
        verifiedName: metaData.verified_name
      };

      // 4. Save
      saveMutation.mutate(finalSettings);
    } catch (error) {
      toast.error('Erro ao conectar com a Meta API. Verifique as credenciais.');
      console.error(error);
    }
  };

  const handleDisconnect = () => {
    const newSettings = { ...formSettings, isConnected: false };
    saveMutation.mutate(newSettings);
    setAccountHealth(null);
  };

  // Direct save settings (for test contact, etc.)
  const handleSaveSettings = (settings: AppSettings) => {
    setFormSettings(settings);
    saveMutation.mutate(settings);
  };

  // Check account health
  const handleCheckHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const health = await checkAccountHealth();
      setAccountHealth(health);

      const summary = getHealthSummary(health);
      if (health.isHealthy) {
        toast.success(summary.title);
      } else if (health.status === 'degraded') {
        toast.warning(summary.title);
      } else {
        toast.error(summary.title);
      }
    } catch (error) {
      toast.error('Erro ao verificar saúde da conta');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  // Quick health check (for pre-send validation)
  const canSendCampaign = async (): Promise<{ canSend: boolean; reason?: string }> => {
    return quickHealthCheck();
  };

  // Set webhook override for a phone number
  const setWebhookOverride = async (phoneNumberId: string, callbackUrl: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/phone-numbers/${phoneNumberId}/webhook/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // accessToken is fetched from Redis on the server
          callbackUrl,
          verifyToken: webhookQuery.data?.webhookToken, // Use the auto-generated token
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Erro ao configurar webhook');
        return false;
      }

      toast.success('Webhook configurado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] });
      return true;
    } catch (error) {
      toast.error('Erro ao configurar webhook');
      return false;
    }
  };

  // Remove webhook override for a phone number
  const removeWebhookOverride = async (phoneNumberId: string): Promise<boolean> => {
    try {
      // No body needed - server fetches credentials from Redis
      const response = await fetch(`/api/phone-numbers/${phoneNumberId}/webhook/override`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Erro ao remover webhook');
        return false;
      }

      toast.success('Webhook removido!');
      queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] });
      return true;
    } catch (error) {
      toast.error('Erro ao remover webhook');
      return false;
    }
  };

  // Build setup wizard steps based on health status
  // Get Vercel stores URL dynamically from health check
  const setupSteps = useMemo((): SetupStep[] => {
    const health = healthQuery.data;
    const storesUrl = health?.vercel?.storesUrl;
    const fallbackStoresUrl = 'https://vercel.com/dashboard/stores';

    return [
      {
        id: 'redis',
        title: 'Upstash Redis',
        description: 'Banco de dados para armazenar credenciais, estatísticas e cache. Adicione via Vercel Storage.',
        status: health?.services.redis.status === 'ok'
          ? 'configured'
          : health?.services.redis.status === 'error'
            ? 'error'
            : 'pending',
        icon: React.createElement(Database, { size: 20, className: 'text-red-400' }),
        actionLabel: 'Adicionar no Vercel',
        actionUrl: storesUrl || fallbackStoresUrl,
        errorMessage: health?.services.redis.message,
        isRequired: true,
      },
      {
        id: 'qstash',
        title: 'Upstash QStash',
        description: 'Filas de mensagens para processamento assíncrono de campanhas. Adicione via Vercel Storage.',
        status: health?.services.qstash.status === 'ok'
          ? 'configured'
          : health?.services.qstash.status === 'error'
            ? 'error'
            : 'pending',
        icon: React.createElement(Zap, { size: 20, className: 'text-purple-400' }),
        actionLabel: 'Adicionar no Vercel',
        actionUrl: storesUrl || fallbackStoresUrl,
        errorMessage: health?.services.qstash.message,
        isRequired: true,
      },
      {
        id: 'whatsapp',
        title: 'WhatsApp Business API',
        description: 'Credenciais da Meta para enviar mensagens. Configure após Redis e QStash estarem prontos.',
        status: health?.services.whatsapp.status === 'ok'
          ? 'configured'
          : health?.services.whatsapp.status === 'error'
            ? 'error'
            : 'pending',
        icon: React.createElement(MessageSquare, { size: 20, className: 'text-green-400' }),
        errorMessage: health?.services.whatsapp.message,
        isRequired: false, // Optional - configure later from Settings page
      },
    ];
  }, [healthQuery.data]);

  // Check if setup is needed (only Redis + QStash required - WhatsApp can be configured in Settings)
  const needsSetup = useMemo(() => {
    const health = healthQuery.data;
    if (!health) return false; // Don't show wizard while loading - show settings instead

    // Only block on Redis and QStash - WhatsApp is configured from the Settings page directly
    return health.services.redis.status !== 'ok' ||
      health.services.qstash.status !== 'ok';
  }, [healthQuery.data]);

  // Check if infrastructure is ready (Redis + QStash configured)
  const infrastructureReady = useMemo(() => {
    const health = healthQuery.data;
    if (!health) return false;

    return health.services.redis.status === 'ok' && health.services.qstash.status === 'ok';
  }, [healthQuery.data]);

  // Check if all steps are configured
  const allConfigured = useMemo(() => {
    return setupSteps.every(step => step.status === 'configured');
  }, [setupSteps]);

  return {
    // Settings with testContact merged from Supabase
    settings: {
      ...formSettings,
      testContact: testContactQuery.data || formSettings.testContact,
    },
    setSettings: setFormSettings,
    isLoading: settingsQuery.isLoading || testContactQuery.isLoading,
    isSaving: saveMutation.isPending,
    onSave: handleSave,
    onSaveSettings: handleSaveSettings,
    onDisconnect: handleDisconnect,
    // Account limits
    accountLimits,
    refreshLimits,
    tierName,
    limitsError,
    limitsErrorMessage,
    limitsLoading,
    hasLimits,
    // Account health
    accountHealth,
    isCheckingHealth,
    onCheckHealth: handleCheckHealth,
    canSendCampaign,
    getHealthSummary: accountHealth ? () => getHealthSummary(accountHealth) : null,
    // Webhook info
    webhookUrl: webhookQuery.data?.webhookUrl,
    webhookToken: webhookQuery.data?.webhookToken,
    webhookStats: webhookQuery.data?.stats,
    // Phone numbers for webhook override
    phoneNumbers: phoneNumbersQuery.data || [],
    phoneNumbersLoading: phoneNumbersQuery.isLoading,
    refreshPhoneNumbers: () => queryClient.invalidateQueries({ queryKey: ['phoneNumbers'] }),
    setWebhookOverride,
    removeWebhookOverride,
    // Available domains for webhook URL
    availableDomains: domainsQuery.data?.domains || [],
    webhookPath: domainsQuery.data?.webhookPath || '/api/webhook',
    selectedDomain: domainsQuery.data?.currentSelection || null,
    // System health
    systemHealth: healthQuery.data || null,
    systemHealthLoading: healthQuery.isLoading,
    refreshSystemHealth: () => queryClient.invalidateQueries({ queryKey: ['systemHealth'] }),
    // Setup wizard
    setupSteps,
    needsSetup,
    infrastructureReady,
    allConfigured,
    // AI Settings
    aiSettings: aiSettingsQuery.data,
    aiSettingsLoading: aiSettingsQuery.isLoading,
    saveAIConfig: saveAIMutation.mutateAsync,
    removeAIKey: removeAIMutation.mutateAsync,
    isSavingAI: saveAIMutation.isPending,
    // Test Contact - persisted in Supabase
    testContact: testContactQuery.data || null,
    testContactLoading: testContactQuery.isLoading,
    saveTestContact: saveTestContactMutation.mutateAsync,
    removeTestContact: removeTestContactMutation.mutateAsync,
    isSavingTestContact: saveTestContactMutation.isPending,
  };
};  
