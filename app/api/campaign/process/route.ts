/**
 * Campaign Processor — direct execution without QStash
 * - Delay aleatório 7-63s entre mensagens (anti-ban)
 * - Suporta múltiplos templates por campanha (sorteio aleatório)
 * - Registra mensagens no GPT Maker para contexto do agente
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { campaignDb, botConversationDb, botMessageDb } from "@/lib/supabase-db";
import { CampaignStatus } from "@/types";
import { getUserFriendlyMessage } from "@/lib/whatsapp-errors";
import { loadProviderConfig } from "@/lib/whatsapp-provider/factory";
import { getWhatsAppCredentials } from "@/lib/whatsapp-credentials";
import { EvolutionProvider } from "@/lib/whatsapp-provider/evolution";

const DEMI_BOT_ID = "demi-gptmaker-v1";

interface Contact {
  phone: string;
  name: string;
}

interface ProcessPayload {
  campaignId: string;
  templateName: string;
  contacts: Contact[];
  templateVariables?: string[];
  phoneNumberId: string;
  accessToken: string;
  orgId?: string | null;
  // Multi-template support: list of template names to randomize
  templateNames?: string[];
  // Anti-ban: interval range in seconds (default 7-63)
  minIntervalSeconds?: number;
  maxIntervalSeconds?: number;
  // URL for IMAGE/VIDEO/DOCUMENT header templates (overrides example from Meta)
  headerMediaUrl?: string;
}

/** Retorna um número inteiro aleatório entre min e max (inclusive) */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Seleciona um template aleatório da lista */
function pickTemplate(names: string[]): string {
  if (!names || names.length === 0) return "";
  return names[Math.floor(Math.random() * names.length)];
}

function buildBodyParameters(
  contactName: string,
  templateVariables: string[] = []
) {
  const all = [contactName || "Cliente", ...templateVariables];
  return all.map((v) => ({ type: "text", text: v }));
}

async function updateContactStatus(
  campaignId: string,
  phone: string,
  status: "sent" | "failed",
  messageId?: string,
  error?: string
) {
  try {
    await supabase
      .from("campaign_contacts")
      .update({
        status,
        sent_at: new Date().toISOString(),
        message_id: messageId || null,
        error: error || null,
      })
      .eq("campaign_id", campaignId)
      .eq("phone", phone);
  } catch (e) {
    console.error(`Failed to update contact status: ${phone}`, e);
  }
}

/** Registra a mensagem enviada no GPT Maker para contexto do agente */
async function registerInGptMaker(
  phone: string,
  templateName: string,
  contactName: string,
  orgId?: string | null,
  templateVariables: string[] = [],
  renderedText?: string
) {
  // Load per-org credentials first, fall back to global env
  let agentId = process.env.GPTMAKER_AGENT_ID;
  let token = process.env.GPTMAKER_JWT_TOKEN;

  if (orgId) {
    try {
      const orgConfig = await loadProviderConfig(orgId);
      if (orgConfig?.gptmakerAgentId) agentId = orgConfig.gptmakerAgentId;
      if (orgConfig?.gptmakerJwtToken) token = orgConfig.gptmakerJwtToken;
    } catch {
      // fall through to global env
    }
  }

  if (!agentId || !token) {
    console.log("[GPTMaker] No credentials configured — skipping registration");
    return;
  }

  // Se o texto já foi renderizado (Evolution), usa diretamente; senão busca no banco local
  let templateText = renderedText ?? await renderTemplateText(templateName, contactName, templateVariables);

  // Se retornou fallback genérico (template não está no banco local, ex: orgs Meta),
  // busca o corpo real na Meta API
  if (templateText.startsWith('[Campanha]')) {
    try {
      const credentials = await getWhatsAppCredentials(orgId);
      if (credentials?.businessAccountId && credentials?.accessToken) {
        const metaRes = await fetch(
          `https://graph.facebook.com/v24.0/${credentials.businessAccountId}/message_templates?name=${templateName}&fields=components`,
          { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const tpl = metaData.data?.[0];
          if (tpl?.components) {
            const bodyComp = tpl.components.find((c: { type: string; text?: string }) => c.type === 'BODY');
            if (bodyComp?.text) {
              const vars = [contactName || 'Cliente', ...templateVariables];
              let body: string = bodyComp.text;
              vars.forEach((v, i) => {
                body = body.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), v);
              });
              templateText = body;
            }
          }
        }
      }
    } catch {
      // mantém o fallback genérico
    }
  }

  try {
    const res = await fetch(
      `https://api.gptmaker.ai/v2/agent/${agentId}/add-message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          context_id: phone,
          phone,
          prompt: templateText,
          role: "assistant",
        }),
      }
    );
    if (!res.ok) {
      console.warn("[GPTMaker] API returned", res.status, await res.text().catch(() => ''));
    } else {
      console.log(`[GPTMaker] Registered context for ${phone}: "${templateText.substring(0, 80)}"`);
    }
  } catch (e) {
    console.error("[GPTMaker] Failed to register campaign message:", e);
  }
}



/** Renders a template body from DB, replacing {{1}}, {{2}}... with actual values */
async function renderTemplateText(
  templateName: string,
  contactName: string,
  templateVariables: string[]
): Promise<string> {
  try {
    const { data: tpl } = await supabase
      .from("templates")
      .select("components")
      .eq("name", templateName)
      .single();
    if (tpl?.components) {
      const comps = Array.isArray(tpl.components) ? tpl.components : [];
      const bodyComp = comps.find((x) => x.type === 'BODY');
      if (!bodyComp?.text) throw new Error('no body');
      const vars = [contactName || "Cliente", ...templateVariables];
      let body: string = bodyComp.text;
      vars.forEach((v, i) => {
        body = body.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, "g"), v);
      });
      return body;
    }
  } catch { /* fall through */ }
  return `[Campanha] Template: ${templateName} para ${contactName || "cliente"}`;
}

/** Validates which contacts have active WhatsApp accounts via Meta Cloud API.
 *  Returns a Set of valid phone numbers. Numbers not in the set should be skipped.
 */
async function validateWhatsAppNumbers(
  phones: string[],
  phoneNumberId: string,
  accessToken: string
): Promise<Set<string>> {
  if (!phones.length) return new Set()

  try {
    const apiUrl = `https://graph.facebook.com/v24.0/${phoneNumberId}/contacts`
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        blocking: 'wait',
        contacts: phones.map(p => (p.startsWith('+') ? p : `+${p}`)),
        force_check: true,
      }),
    })

    if (!res.ok) {
      console.warn(`[Validation] Meta API returned ${res.status} — skipping validation, treating all as valid`)
      return new Set(phones)
    }

    const data = await res.json()
    const validSet = new Set<string>()

    for (const entry of data.contacts ?? []) {
      if (entry.status === 'valid' && entry.input) {
        // normalize: remove leading +
        const normalized = entry.input.replace(/^\+/, '')
        validSet.add(normalized)
        validSet.add(entry.input) // also keep with +
      }
    }

    console.log(`[Validation] ${validSet.size}/${phones.length} numbers have WhatsApp`)
    return validSet
  } catch (e) {
    console.warn('[Validation] Failed to validate numbers — treating all as valid:', e)
    return new Set(phones)
  }
}

export async function POST(request: NextRequest) {
  let payload: ProcessPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    campaignId,
    templateName,
    contacts,
    templateVariables = [],
    phoneNumberId,
    accessToken,
    templateNames,
    minIntervalSeconds = 7,
    maxIntervalSeconds = 63,
  } = payload;

  const orgConfig = payload.orgId ? await loadProviderConfig(payload.orgId).catch(() => null) : null;
  const isEvolution = orgConfig?.type === "evolution";

  if (!campaignId || !contacts?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Load Meta credentials from Redis if not passed (e.g. called by scheduler)
  let resolvedPhoneId = phoneNumberId;
  let resolvedToken = accessToken;
  let resolvedBusinessAccountId = '';
  if (!isEvolution && payload.orgId) {
    const redisCreds = await getWhatsAppCredentials(payload.orgId).catch(() => null);
    if (redisCreds) {
      resolvedPhoneId = resolvedPhoneId || redisCreds.phoneNumberId;
      resolvedToken = resolvedToken || redisCreds.accessToken;
      resolvedBusinessAccountId = redisCreds.businessAccountId || '';
    }
  }
  if (!resolvedPhoneId) resolvedPhoneId = process.env.WHATSAPP_PHONE_ID || "";
  if (!resolvedToken) resolvedToken = process.env.WHATSAPP_TOKEN || "";

  if (!isEvolution && (!resolvedPhoneId || !resolvedToken)) {
    return NextResponse.json({ error: "phoneNumberId and accessToken required for Meta Cloud API" }, { status: 400 });
  }

  // Lista de templates para sortear (pode ser 1 ou vários)
  const allTemplates: string[] = templateNames?.length
    ? templateNames
    : templateName
    ? [templateName]
    : [];

  if (allTemplates.length === 0) {
    return NextResponse.json({ error: "templateName or templateNames required" }, { status: 400 });
  }

  console.log(
    `🚀 [Process] Campaign ${campaignId} — ${contacts.length} contacts, templates: [${allTemplates.join(", ")}], delay: ${minIntervalSeconds}-${maxIntervalSeconds}s`
  );

  // Fetch header component info once per campaign (IMAGE/VIDEO/DOCUMENT headers require a media parameter)
  const templateHeaderInfo = new Map<string, { format: string; exampleUrl?: string }>();
  if (!isEvolution && resolvedBusinessAccountId && resolvedToken) {
    const uniqueTemplates = [...new Set(allTemplates)];
    for (const tname of uniqueTemplates) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v24.0/${resolvedBusinessAccountId}/message_templates?name=${tname}&fields=name,components`,
          { headers: { Authorization: `Bearer ${resolvedToken}` } }
        );
        if (res.ok) {
          const data = await res.json();
          const tpl = data.data?.[0];
          if (tpl) {
            const headerComp = tpl.components?.find((c: { type: string; format?: string }) => c.type === 'HEADER');
            if (headerComp?.format && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
              templateHeaderInfo.set(tname, {
                format: headerComp.format as string,
                exampleUrl: headerComp.example?.header_handle?.[0] ?? headerComp.example?.header_url?.[0],
              });
              console.log(`[Process] Template "${tname}" has ${headerComp.format} header`);
            }
          }
        }
      } catch (e) {
        console.warn(`[Process] Failed to fetch header info for template "${tname}":`, e);
      }
    }
  }

  // Validate WhatsApp numbers before sending
  const allPhones = contacts.map(c => c.phone)
  let validPhones: Set<string>
  if (isEvolution) {
    const evoProvider = new EvolutionProvider(
      orgConfig!.evolutionUrl || process.env.EVOLUTION_API_URL || 'http://evolution_api:8080',
      orgConfig!.evolutionApiKey || process.env.EVOLUTION_API_KEY || '',
      orgConfig!.evolutionInstance || process.env.EVOLUTION_INSTANCE || 'SmartZap'
    )
    validPhones = await evoProvider.checkNumbers(allPhones)
  } else {
    validPhones = await validateWhatsAppNumbers(allPhones, resolvedPhoneId, resolvedToken)
  }

  // Mark invalid contacts immediately
  const invalidContacts = contacts.filter(c => {
    const normalized = c.phone.replace(/^\+/, '')
    return !validPhones.has(c.phone) && !validPhones.has(normalized) && !validPhones.has(`+${normalized}`)
  })
  if (invalidContacts.length > 0) {
    console.log(`[Validation] Marking ${invalidContacts.length} contacts as invalid`)
    for (const inv of invalidContacts) {
      await supabase
        .from('campaign_contacts')
        .update({ status: 'invalid', sent_at: new Date().toISOString(), error: 'Número sem WhatsApp ativo' })
        .eq('campaign_id', campaignId)
        .eq('phone', inv.phone)
    }
  }

  // Filter to only valid contacts
  const validContacts = contacts.filter(c => {
    const normalized = c.phone.replace(/^\+/, '')
    return validPhones.has(c.phone) || validPhones.has(normalized) || validPhones.has(`+${normalized}`)
  })

  if (validContacts.length === 0) {
    await campaignDb.updateStatus(campaignId, {
      sent: 0,
      failed: 0,
      status: CampaignStatus.COMPLETED,
      completedAt: new Date().toISOString(),
    })
    return NextResponse.json({ sent: 0, failed: 0, invalid: invalidContacts.length })
  }

  console.log(`[Validation] Sending to ${validContacts.length}/${contacts.length} valid contacts`)

  // Mark as SENDING
  await campaignDb.updateStatus(campaignId, {
    status: CampaignStatus.SENDING,
    startedAt: new Date().toISOString(),
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const contact of validContacts) {
    try {
      // Check if paused
      const { data: camp } = await supabase
        .from("campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();

      if (camp?.status === CampaignStatus.PAUSED) {
        console.log(`⏸️  Campaign ${campaignId} paused — stopping`);
        break;
      }

      // Sorteia template aleatório para este contato (anti-ban por variação)
      const chosenTemplate = pickTemplate(allTemplates);

      let messageId: string | undefined;
      let sendError: string | undefined;
      let renderedText: string | undefined;

      if (isEvolution) {
        // ── Evolution API: send free-text rendered from template body ────────
        const text = await renderTemplateText(chosenTemplate, contact.name, templateVariables);
        renderedText = text;
        const evoProvider = new EvolutionProvider(
          orgConfig!.evolutionUrl || process.env.EVOLUTION_API_URL || "http://evolution_api:8080",
          orgConfig!.evolutionApiKey || process.env.EVOLUTION_API_KEY || "",
          orgConfig!.evolutionInstance || process.env.EVOLUTION_INSTANCE || "SmartZap"
        );
        const result = await evoProvider.sendText({
          phone: contact.phone,
          text,
          simulateTyping: true,
          typingDurationMs: randomBetween(800, 2500),
        });
        if (result.success) {
          messageId = result.messageId;
        } else {
          sendError = result.error || "Erro desconhecido (Evolution)";
        }
      } else {
        // ── Meta Cloud API: send approved template ───────────────────────────
        const templateComponents: unknown[] = [];

        // Header component — required for IMAGE/VIDEO/DOCUMENT header templates
        const headerInfo = templateHeaderInfo.get(chosenTemplate);
        if (headerInfo) {
          const mediaUrl = payload.headerMediaUrl || headerInfo.exampleUrl;
          if (mediaUrl) {
            const mediaType = headerInfo.format.toLowerCase();
            templateComponents.push({
              type: 'header',
              parameters: [{ type: mediaType, [mediaType]: { link: mediaUrl } }],
            });
          } else {
            console.warn(`[Process] Template "${chosenTemplate}" has ${headerInfo.format} header but no image URL — skipping header component`);
          }
        }

        // Body component — only if there are real (non-empty) variables
        const effectiveBodyVars = (templateVariables ?? []).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
        if (effectiveBodyVars.length > 0) {
          templateComponents.push({ type: 'body', parameters: buildBodyParameters(contact.name, effectiveBodyVars) });
        }

        const templateObj: Record<string, unknown> = {
          name: chosenTemplate,
          language: { code: "pt_BR" },
          ...(templateComponents.length > 0 && { components: templateComponents }),
        };
        const apiUrl = `https://graph.facebook.com/v24.0/${resolvedPhoneId}/messages`;
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${resolvedToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: contact.phone,
            type: "template",
            template: templateObj,
          }),
        });
        const data = await res.json();
        if (res.ok && data.messages?.[0]?.id) {
          messageId = data.messages[0].id;
        } else {
          const errorCode = data.error?.code || 0;
          sendError = `(#${errorCode}) ${getUserFriendlyMessage(errorCode) || data.error?.message || "Unknown error"}`;
        }
      }

      if (messageId) {
        await updateContactStatus(campaignId, contact.phone, "sent", messageId);
        sentCount++;
        const channel = isEvolution ? "Evolution" : "Meta";
        console.log(`✅ [${channel}] Sent to ${contact.phone} (template: ${chosenTemplate}) — msgId: ${messageId}`);

        // Salva no histórico de conversas + registra no GPT Maker
        ;(async () => {
          try {
            const botId = orgConfig?.gptmakerAgentId || DEMI_BOT_ID;
            let conv = await botConversationDb.getByContact(botId, contact.phone, payload.orgId || undefined);
            if (!conv) {
              conv = await botConversationDb.create({
                botId,
                contactPhone: contact.phone,
                contactName: contact.name || undefined,
                organizationId: payload.orgId || undefined,
              });
            }
            await botMessageDb.create({
              conversationId: conv.id,
              waMessageId: messageId,
              direction: "outbound",
              origin: "bot",
              type: "template",
              content: {
                templateName: chosenTemplate,
                text: renderedText ?? `Template "${chosenTemplate}" enviado para ${contact.name || contact.phone}`,
              },
              status: "sent",
            });
            if (!orgConfig?.gptmakerDirectChannel) {
              await registerInGptMaker(contact.phone, chosenTemplate, contact.name, payload.orgId, templateVariables, renderedText);
            }
          } catch (e) {
            console.error("[Campaign] Failed to log template dispatch:", e);
          }
        })();
      } else {
        await updateContactStatus(campaignId, contact.phone, "failed", undefined, sendError);
        failedCount++;
        console.log(`❌ Failed ${contact.phone}: ${sendError}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Erro desconhecido";
      await updateContactStatus(campaignId, contact.phone, "failed", undefined, errMsg);
      failedCount++;
      console.error(`❌ Exception ${contact.phone}:`, err);
    }

    // ✅ Anti-ban: delay aleatório (Evolution usa intervalos maiores para evitar ban)
    const delaySec = randomBetween(minIntervalSeconds, maxIntervalSeconds);
    console.log(`⏳ Aguardando ${delaySec}s antes do próximo envio...`);
    await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
  }

  // Update campaign stats + mark complete
  const campaign = await campaignDb.getById(campaignId);
  if (campaign) {
    const finalSent = (campaign.sent || 0) + sentCount;
    const finalFailed = (campaign.failed || 0) + failedCount;
    const finalStatus =
      finalFailed === contacts.length && contacts.length > 0
        ? CampaignStatus.FAILED
        : CampaignStatus.COMPLETED;

    await campaignDb.updateStatus(campaignId, {
      sent: finalSent,
      failed: finalFailed,
      status: finalStatus,
      completedAt: new Date().toISOString(),
    });
  }

  console.log(
    `🎉 [Process] Campaign ${campaignId} done — sent: ${sentCount}, failed: ${failedCount}`
  );

  return NextResponse.json({ sent: sentCount, failed: failedCount });
}
