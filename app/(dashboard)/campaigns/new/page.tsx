'use client'

import { useCampaignWizardController } from '@/hooks/useCampaignWizard'
import { CampaignWizardView } from '@/components/features/campaigns/CampaignWizardView'

export default function NewCampaignPage() {
  const controller = useCampaignWizardController()

  return (
    <CampaignWizardView
      step={controller.step}
      setStep={controller.setStep}
      name={controller.name}
      setName={controller.setName}
      selectedTemplateId={controller.selectedTemplateId}
      setSelectedTemplateId={controller.setSelectedTemplateId}
      recipientSource={controller.recipientSource}
      setRecipientSource={controller.setRecipientSource}
      totalContacts={controller.totalContacts}
      recipientCount={controller.recipientCount}
      allContacts={controller.allContacts}
      selectedContacts={controller.selectedContacts}
      selectedContactIds={controller.selectedContactIds}
      toggleContact={controller.toggleContact}
      excelContacts={controller.excelContacts}
      setExcelContacts={controller.setExcelContacts}
      availableTemplates={controller.availableTemplates}
      selectedTemplate={controller.selectedTemplate}
      handleNext={controller.handleNext}
      handleBack={controller.handleBack}
      handleSend={controller.handleSend}
      isCreating={controller.isCreating}
      isLoading={controller.isLoading}
      testContact={controller.testContact}
      // Template Variables
      templateVariables={controller.templateVariables}
      setTemplateVariables={controller.setTemplateVariables}
      variableColumnMap={controller.variableColumnMap}
      setVariableColumnMap={controller.setVariableColumnMap}
      availableExcelColumns={controller.availableExcelColumns}
      templateVariableCount={controller.templateVariableCount}
      templateVariableInfo={controller.templateVariableInfo}
      // Account Limits
      accountLimits={controller.accountLimits}
      isBlockModalOpen={controller.isBlockModalOpen}
      setIsBlockModalOpen={controller.setIsBlockModalOpen}
      blockReason={controller.blockReason}
      liveValidation={controller.liveValidation}
      isOverLimit={controller.isOverLimit}
      currentLimit={controller.currentLimit}
      antiBanConfig={controller.antiBanConfig}
      setAntiBanConfig={controller.setAntiBanConfig}
      providerType={controller.providerType}
      setProviderType={controller.setProviderType}
      additionalTemplateIds={controller.additionalTemplateIds}
      setAdditionalTemplateIds={controller.setAdditionalTemplateIds}
      additionalTemplates={controller.additionalTemplates}
      headerImageFile={controller.headerImageFile}
      setHeaderImageFile={controller.setHeaderImageFile}
      headerImageUrl={controller.headerImageUrl}
      setHeaderImageUrl={controller.setHeaderImageUrl}
    />
  )
}
