/**
 * API Validation Schemas
 * 
 * Zod schemas for validating API request bodies
 * Used by API routes to ensure data integrity
 */

import { z } from 'zod'
import { CampaignStatus, ContactStatus } from '@/types'

// ============================================================================
// Contact Schemas
// ============================================================================

export const CreateContactSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  phone: z.string()
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .max(20, 'Telefone muito longo')
    .regex(/^[\d+\-\s()]+$/, 'Formato de telefone inválido'),
  email: z.string().email('Email inválido').optional().nullable(),
  status: z.nativeEnum(ContactStatus).optional().default(ContactStatus.OPT_IN),
  tags: z.array(z.string().max(50)).max(20, 'Máximo de 20 tags').optional().default([]),
  notes: z.string().max(500, 'Notas muito longas').optional(),
})

export const UpdateContactSchema = CreateContactSchema.partial()

export const ImportContactsSchema = z.object({
  contacts: z.array(
    z.object({
      name: z.string().max(100).optional().default(''),
      phone: z.string().min(1, 'Telefone é obrigatório'),
      email: z.string().email().optional().nullable(),
      tags: z.array(z.string()).optional(),
    })
  )
    .min(1, 'Lista de contatos vazia')
    .max(10000, 'Máximo de 10.000 contatos por importação'),
})

export const DeleteContactsSchema = z.object({
  ids: z.array(z.string().min(1, 'ID inválido')).min(1, 'Selecione pelo menos um contato'),
})

// ============================================================================
// Campaign Schemas
// ============================================================================

export const CreateCampaignSchema = z.object({
  name: z.string()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome muito longo'),
  templateName: z.string().min(1, 'Template é obrigatório'),
  recipients: z.number().int().min(0).optional().default(0),
  scheduledAt: z.string().datetime().optional(),
  selectedContactIds: z.array(z.string()).optional(),
  templateVariables: z.array(z.string()).optional(),  // Fallback static values for {{2}}, {{3}}, etc.
  variableColumnMap: z.record(z.string(), z.string()).optional(),  // Maps a variable slot to a spreadsheet column, for per-contact values
  // Anti-ban fields (Evolution API)
  providerType: z.enum(['meta', 'evolution']).optional(),
  delayMinSec: z.number().int().min(1).max(3600).optional(),
  delayMaxSec: z.number().int().min(1).max(3600).optional(),
  simulateTyping: z.boolean().optional(),
  dailyLimit: z.number().int().min(0).max(10000).optional().nullable(),
  messageVariants: z.array(z.string()).optional(),
  headerMediaUrl: z.string().url().optional(),
  contacts: z.array(
    z.object({
      name: z.string().max(100).optional(),
      phone: z.string().min(1),
      vars: z.record(z.string(), z.string()).optional(),
    })
  ).optional(),
})

export const UpdateCampaignSchema = z.object({
  name: z.string().max(100).optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
  templateName: z.string().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  sent: z.number().int().min(0).optional(),
  delivered: z.number().int().min(0).optional(),
  read: z.number().int().min(0).optional(),
  failed: z.number().int().min(0).optional(),
})

// ============================================================================
// Campaign Dispatch Schema
// ============================================================================

export const DispatchCampaignSchema = z.object({
  campaignId: z.string().uuid('ID de campanha inválido'),
  templateName: z.string().min(1, 'Nome do template é obrigatório'),
  contacts: z.array(
    z.object({
      phone: z.string().min(1),
      name: z.string().optional(),
      variables: z.array(z.string()).optional(),
    })
  ).min(1, 'Pelo menos um contato é necessário').max(100000, 'Máximo de 100.000 contatos'),
})

// ============================================================================
// Credentials Schema
// ============================================================================

export const SaveCredentialsSchema = z.object({
  phoneNumberId: z.string().min(1, 'Phone Number ID é obrigatório'),
  businessAccountId: z.string().min(1, 'Business Account ID é obrigatório'),
  accessToken: z.string().min(1, 'Access Token é obrigatório'),
  displayPhoneNumber: z.string().optional(),
  verifiedName: z.string().optional(),
})

// ============================================================================
// Database Migration Schema
// ============================================================================

export const MigrateDataSchema = z.object({
  campaigns: z.array(z.unknown()).optional(),
  contacts: z.array(
    z.object({
      name: z.string().optional(),
      phone: z.string().min(1),
      status: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
  ).optional(),
})

// ============================================================================
// AI Template Generation Schema
// ============================================================================

export const GenerateTemplateSchema = z.object({
  prompt: z.string()
    .min(10, 'Descrição muito curta')
    .max(2000, 'Descrição muito longa'),
})

// ============================================================================
// Account Limits Schema
// ============================================================================

export const UpdateLimitsSchema = z.object({
  dailyLimit: z.number().int().min(0).max(100000).optional(),
  monthlyLimit: z.number().int().min(0).max(10000000).optional(),
})

// ============================================================================
// Helper Function
// ============================================================================

/**
 * Validate request body and return typed result or error response
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return { success: false, error: result.error }
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root'
    if (!formatted[path]) {
      formatted[path] = []
    }
    formatted[path].push(issue.message)
  }

  return formatted
}
