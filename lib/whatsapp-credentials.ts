/**
 * WhatsApp Credentials Helper
 * 
 * Centralizes credential management with Redis-first strategy
 * and fallback to environment variables.
 */

import { redis, isRedisAvailable } from './redis'

const CREDENTIALS_KEY = 'settings:whatsapp:credentials'

export interface WhatsAppCredentials {
  phoneNumberId: string
  businessAccountId: string
  accessToken: string
  displayPhoneNumber?: string
  verifiedName?: string
}

/**
 * Get WhatsApp credentials from Redis (primary) or env vars (fallback)
 * 
 * Priority:
 * 1. Redis (user-configured via Settings UI)
 * 2. Environment variables (Vercel/deployment configured)
 * 
 * @returns Credentials or null if not configured
 */
export async function getWhatsAppCredentials(): Promise<WhatsAppCredentials | null> {
  // 1. Try Redis first
  if (isRedisAvailable() && redis) {
    try {
      const stored = await redis.get(CREDENTIALS_KEY)
      if (stored) {
        const credentials = typeof stored === 'string' ? JSON.parse(stored) : stored
        if (credentials.phoneNumberId && credentials.accessToken) {
          return {
            phoneNumberId: credentials.phoneNumberId,
            businessAccountId: credentials.businessAccountId,
            accessToken: credentials.accessToken,
            displayPhoneNumber: credentials.displayPhoneNumber,
            verifiedName: credentials.verifiedName,
          }
        }
      }
    } catch (error) {
      console.error('Error reading credentials from Redis:', error)
    }
  }

  // 2. Fallback to env vars
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  const accessToken = process.env.WHATSAPP_TOKEN

  if (phoneNumberId && businessAccountId && accessToken) {
    return {
      phoneNumberId,
      businessAccountId,
      accessToken,
    }
  }

  // Not configured
  return null
}

/**
 * Check if WhatsApp is configured (either in Redis or env vars)
 */
export async function isWhatsAppConfigured(): Promise<boolean> {
  const credentials = await getWhatsAppCredentials()
  return credentials !== null
}

/**
 * Get credentials source (for debugging/UI)
 */
export async function getCredentialsSource(): Promise<'redis' | 'env' | 'none'> {
  // Check Redis first
  if (isRedisAvailable() && redis) {
    try {
      const stored = await redis.get(CREDENTIALS_KEY)
      if (stored) {
        const credentials = typeof stored === 'string' ? JSON.parse(stored) : stored
        if (credentials.phoneNumberId && credentials.accessToken) {
          return 'redis'
        }
      }
    } catch {
      // Fall through to env check
    }
  }

  // Check env vars
  if (process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TOKEN) {
    return 'env'
  }

  return 'none'
}

/**
 * Save WhatsApp credentials to Redis
 * Used to keep settings:whatsapp:credentials in sync with whatsapp:provider:config
 */
export async function saveWhatsAppCredentials(credentials: Partial<WhatsAppCredentials>): Promise<void> {
  if (!isRedisAvailable() || !redis) return
  try {
    // Merge with existing to preserve fields not being updated
    const existing = await getWhatsAppCredentials()
    const merged = { ...existing, ...credentials }
    await redis.set(CREDENTIALS_KEY, JSON.stringify(merged))
  } catch (error) {
    console.error('Error saving credentials to Redis:', error)
  }
}
