/**
 * WhatsApp Provider Factory
 * Cria o provider certo baseado nas configurações salvas no Redis/env
 * Suporta multi-org: cada organização tem sua própria config no Redis.
 */

import { MetaProvider } from "./meta";
import { EvolutionProvider } from "./evolution";
import type { IWhatsAppProvider, ProviderConfig, WhatsAppProviderType } from "./types";
import { getWhatsAppCredentials, saveWhatsAppCredentials } from "@/lib/whatsapp-credentials";
import { redis } from "@/lib/redis";

// ── Keys (per-org) ────────────────────────────────────────────────────────────

function providerConfigKey(orgId?: string | null): string {
  if (orgId && orgId !== "*") return `whatsapp:provider:config:${orgId}`;
  return "whatsapp:provider:config"; // fallback global (super_admin sem org)
}

// ── Persistência ──────────────────────────────────────────────────────────────

export async function saveProviderConfig(
  config: ProviderConfig,
  orgId?: string | null
): Promise<void> {
  const key = providerConfigKey(orgId);
  await redis.set(key, JSON.stringify(config));

  // Keep settings:whatsapp:credentials in sync (scoped by org)
  if (config.type === "meta" && config.phoneNumberId && config.accessToken) {
    await saveWhatsAppCredentials(
      {
        phoneNumberId: config.phoneNumberId,
        businessAccountId: config.businessAccountId || "",
        accessToken: config.accessToken,
      },
      orgId
    );
  }
}

export async function loadProviderConfig(
  orgId?: string | null
): Promise<ProviderConfig | null> {
  try {
    const key = providerConfigKey(orgId);
    const raw = await redis.get(key);

    // If org-specific key not found, fall back to global key (handles migration
    // from single-org setup and super_admin without active org cookie)
    if (!raw && orgId && orgId !== "*") {
      const globalRaw = await redis.get("whatsapp:provider:config");
      if (globalRaw) {
        return JSON.parse(
          typeof globalRaw === "string" ? globalRaw : JSON.stringify(globalRaw)
        ) as ProviderConfig;
      }
    }

    if (!raw) return null;
    return JSON.parse(
      typeof raw === "string" ? raw : JSON.stringify(raw)
    ) as ProviderConfig;
  } catch {
    return null;
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export async function createWhatsAppProvider(
  orgId?: string | null
): Promise<IWhatsAppProvider> {
  const config = await loadProviderConfig(orgId);
  const providerType: WhatsAppProviderType = config?.type || "meta";

  if (providerType === "evolution") {
    const url =
      config?.evolutionUrl || process.env.EVOLUTION_API_URL || "";
    const key =
      config?.evolutionApiKey || process.env.EVOLUTION_API_KEY || "";
    const instance =
      config?.evolutionInstance ||
      process.env.EVOLUTION_INSTANCE ||
      "SmartZap";

    if (!url || !key) {
      throw new Error(
        "Evolution API não configurada. Acesse Configurações → WhatsApp."
      );
    }

    return new EvolutionProvider(url, key, instance);
  }

  // Default: Meta Cloud API
  const redisCredentials = await getWhatsAppCredentials(orgId);
  const phoneNumberId =
    config?.phoneNumberId ||
    redisCredentials?.phoneNumberId ||
    process.env.WHATSAPP_PHONE_ID ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    "";

  const accessToken =
    config?.accessToken ||
    redisCredentials?.accessToken ||
    process.env.WHATSAPP_TOKEN ||
    "";

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "Credenciais Meta não configuradas. Acesse Configurações → WhatsApp."
    );
  }

  return new MetaProvider(phoneNumberId, accessToken);
}

export { MetaProvider, EvolutionProvider };
export type { IWhatsAppProvider, ProviderConfig, WhatsAppProviderType };
