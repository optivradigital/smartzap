'use client'

import { useState } from 'react'
import { useSettingsController } from '@/hooks/useSettings'
import { SettingsView } from '@/components/features/settings/SettingsView'
import { SetupWizardView } from '@/components/features/settings/SetupWizardView'

export default function SettingsPage() {
  const controller = useSettingsController()
  const [skipWizard, setSkipWizard] = useState(false)

  // Show Setup Wizard if infrastructure is not ready (Redis + QStash)
  // User can skip to settings if they want to configure WhatsApp anyway
  const showWizard = controller.needsSetup && !skipWizard

  if (showWizard) {
    return (
      <SetupWizardView
        steps={controller.setupSteps}
        isLoading={controller.systemHealthLoading}
        onRefresh={controller.refreshSystemHealth}
        onContinueToSettings={
          controller.infrastructureReady
            ? () => setSkipWizard(true)
            : undefined
        }
        allConfigured={controller.allConfigured}
      />
    )
  }

  return (
    <div>
      {/* Header - fora do grid */}
      <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">Configurações</h1>
      <p className="text-muted-foreground mb-10">Conexão do WhatsApp, equipe e preferências da organização</p>

      {/* Grid responsivo: mobile=1col, xl=3col */}
      <div className="flex flex-col xl:flex-row gap-8">
        {/* Settings Main Content */}
        <div className="flex-1 min-w-0 xl:max-w-3xl">
          <SettingsView
            settings={controller.settings}
            setSettings={controller.setSettings}
            isLoading={controller.isLoading}
            isSaving={controller.isSaving}
            onSave={controller.onSave}
            onSaveSettings={controller.onSaveSettings}
            onDisconnect={controller.onDisconnect}
            accountLimits={controller.accountLimits}
            tierName={controller.tierName}
            limitsError={controller.limitsError}
            limitsErrorMessage={controller.limitsErrorMessage}
            limitsLoading={controller.limitsLoading}
            onRefreshLimits={controller.refreshLimits}
            webhookUrl={controller.webhookUrl}
            webhookToken={controller.webhookToken}
            webhookStats={controller.webhookStats}
            phoneNumbers={controller.phoneNumbers}
            phoneNumbersLoading={controller.phoneNumbersLoading}
            onRefreshPhoneNumbers={controller.refreshPhoneNumbers}
            onSetWebhookOverride={controller.setWebhookOverride}
            onRemoveWebhookOverride={controller.removeWebhookOverride}
            availableDomains={controller.availableDomains}

            webhookPath={controller.webhookPath}
            // AI Settings
            aiSettings={controller.aiSettings}
            aiSettingsLoading={controller.aiSettingsLoading}
            saveAIConfig={controller.saveAIConfig}
            removeAIKey={controller.removeAIKey}
            isSavingAI={controller.isSavingAI}
            // Test Contact - Supabase
            testContact={controller.testContact}
            saveTestContact={controller.saveTestContact}
            removeTestContact={controller.removeTestContact}
            isSavingTestContact={controller.isSavingTestContact}
            hideHeader
          />
        </div>

      </div>
    </div>
  )
}
