/**
 * WhatsApp Credentials Helper
 *
 * Centralizes credential management with Redis-first strategy
 * and fallback to environment variables.
 * Supports multi-org: credentials are scoped by orgId.
 */

import { redis, isRedisAvailable } from "./redis";

function credentialsKey(orgId?: string | null): string {
  if (orgId && orgId !== "*") return `settings:whatsapp:credentials:${orgId}`;
  return "settings:whatsapp:credentials"; // fallback global
}

export interface WhatsAppCredentials {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
}

/**
 * Get WhatsApp credentials scoped by org.
 * Priority: Redis (org-scoped) → Redis (global fallback) → env vars
 */
export async function getWhatsAppCredentials(
  orgId?: string | null
): Promise<WhatsAppCredentials | null> {
  if (isRedisAvailable() && redis) {
    try {
      // 1. Try org-scoped key
      const key = credentialsKey(orgId);
      const stored = await redis.get(key);
      if (stored) {
        const credentials =
          typeof stored === "string" ? JSON.parse(stored) : stored;
        if (credentials.phoneNumberId && credentials.accessToken) {
          return {
            phoneNumberId: credentials.phoneNumberId,
            businessAccountId: credentials.businessAccountId,
            accessToken: credentials.accessToken,
            displayPhoneNumber: credentials.displayPhoneNumber,
            verifiedName: credentials.verifiedName,
          };
        }
      }
    } catch (error) {
      console.error("Error reading credentials from Redis:", error);
    }
  }

  // 2. Fallback to env vars (only if no orgId or global request)
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.WHATSAPP_TOKEN;

  if (phoneNumberId && businessAccountId && accessToken) {
    return { phoneNumberId, businessAccountId, accessToken };
  }

  return null;
}

export async function isWhatsAppConfigured(
  orgId?: string | null
): Promise<boolean> {
  const credentials = await getWhatsAppCredentials(orgId);
  return credentials !== null;
}

export async function getCredentialsSource(
  orgId?: string | null
): Promise<"redis" | "env" | "none"> {
  if (isRedisAvailable() && redis) {
    try {
      const stored = await redis.get(credentialsKey(orgId));
      if (stored) {
        const credentials =
          typeof stored === "string" ? JSON.parse(stored) : stored;
        if (credentials.phoneNumberId && credentials.accessToken) return "redis";
      }
    } catch {
      // fall through
    }
  }
  if (process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TOKEN) return "env";
  return "none";
}

/**
 * Save WhatsApp credentials to Redis, scoped by org.
 */
export async function saveWhatsAppCredentials(
  credentials: Partial<WhatsAppCredentials>,
  orgId?: string | null
): Promise<void> {
  if (!isRedisAvailable() || !redis) return;
  try {
    const existing = await getWhatsAppCredentials(orgId);
    const merged = { ...existing, ...credentials };
    await redis.set(credentialsKey(orgId), JSON.stringify(merged));
  } catch (error) {
    console.error("Error saving credentials to Redis:", error);
  }
}
