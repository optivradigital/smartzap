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

export const NOT_CONFIGURED_MSG =
  "WhatsApp não configurado para esta organização. Acesse Configurações → WhatsApp.";

export function isOrgScoped(orgId?: string | null): orgId is string {
  return !!orgId && orgId !== "*";
}

/** Org dona de uma instância Evolution (só configs do tipo evolution). */
export async function findOrgByEvolutionInstance(
  instanceName: string
): Promise<string | null> {
  if (!instanceName) return null;
  try {
    const keys = await redis.keys("whatsapp:provider:config:*");
    for (const key of keys) {
      const raw = await redis.get(key);
      if (!raw) continue;
      const config = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
      // Configs Meta guardam evolutionInstance antigo ("SmartZap") — ignorar
      if (config.type === "evolution" && config.evolutionInstance === instanceName) {
        return key.replace("whatsapp:provider:config:", "");
      }
    }
  } catch { /* non-fatal */ }
  return null;
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
    // Sem fallback para a chave global: org sem config própria = não configurada
    // (antes herdava o número de outra org).
    const raw = await redis.get(providerConfigKey(orgId));

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
  const isOrg = isOrgScoped(orgId);
  if (isOrg && !config) {
    throw new Error(NOT_CONFIGURED_MSG);
  }
  // If no saved config but EVOLUTION_API_URL is set in env, use evolution
  const providerType: WhatsAppProviderType =
    config?.type || (process.env.EVOLUTION_API_URL ? "evolution" : "meta");

  if (providerType === "evolution") {
    const url =
      config?.evolutionUrl || process.env.EVOLUTION_API_URL || "";
    const key =
      config?.evolutionApiKey || process.env.EVOLUTION_API_KEY || "";
    // URL/key da Evolution são infra compartilhada; a instância (o número) é sempre da org.
    const instance = isOrg
      ? config?.evolutionInstance || ""
      : config?.evolutionInstance || process.env.EVOLUTION_INSTANCE || "SmartZap";

    if (!url || !key || !instance) {
      throw new Error(
        "Evolution API não configurada. Acesse Configurações → WhatsApp."
      );
    }

    return new EvolutionProvider(url, key, instance);
  }

  // Default: Meta Cloud API
  const redisCredentials = await getWhatsAppCredentials(orgId);
  const envPhoneId = isOrg ? "" : process.env.WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const envToken = isOrg ? "" : process.env.WHATSAPP_TOKEN || "";
  const phoneNumberId =
    config?.phoneNumberId || redisCredentials?.phoneNumberId || envPhoneId;

  const accessToken =
    config?.accessToken || redisCredentials?.accessToken || envToken;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "Credenciais Meta não configuradas. Acesse Configurações → WhatsApp."
    );
  }

  return new MetaProvider(phoneNumberId, accessToken);
}

export { MetaProvider, EvolutionProvider };
export type { IWhatsAppProvider, ProviderConfig, WhatsAppProviderType };
