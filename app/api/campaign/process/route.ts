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
  orgId?: string | null
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

  // Fetch actual template body text from DB for richer context
  let templateText = `[Campanha enviada] Template: "${templateName}" para ${contactName || phone}`;
  try {
    const { data: tpl } = await supabase
      .from("templates")
      .select("body")
      .eq("name", templateName)
      .single();
    if (tpl?.body) {
      templateText = tpl.body.replace(/{{\d+}}/g, contactName || phone);
    }
  } catch {
    // use fallback text
  }

  try {
    const res = await fetch(
      `https://api.gptmaker.ai/v2/agent/${agentId}/conversation`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contextId: phone,
          prompt: templateText,
          role: "assistant",
        }),
      }
    );
    if (!res.ok) {
      console.warn("[GPTMaker] API returned", res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.error("[GPTMaker] Failed to register campaign message:", e);
  }
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

  if (!campaignId || !contacts?.length || !phoneNumberId || !accessToken) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

  // Validate WhatsApp numbers before sending
  const allPhones = contacts.map(c => c.phone)
  const validPhones = await validateWhatsAppNumbers(allPhones, phoneNumberId, accessToken)

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

      const templateObj: Record<string, unknown> = {
        name: chosenTemplate,
        language: { code: "pt_BR" },
      };

      if (templateVariables.length > 0) {
        const bodyParameters = buildBodyParameters(contact.name, templateVariables);
        templateObj.components = [{ type: "body", parameters: bodyParameters }];
      }

      const apiUrl = `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: contact.phone,
          type: "template",
          template: templateObj,
        }),
      });

      const data = await res.json();

      if (res.ok && data.messages?.[0]?.id) {
        const messageId = data.messages[0].id;
        await updateContactStatus(campaignId, contact.phone, "sent", messageId);
        sentCount++;
        console.log(`✅ Sent to ${contact.phone} (template: ${chosenTemplate}) — msgId: ${messageId}`);

        // Salva no histórico de conversas + registra no GPT Maker
        ;(async () => {
          try {
            let conv = await botConversationDb.getByContact(DEMI_BOT_ID, contact.phone);
            if (!conv) {
              conv = await botConversationDb.create({
                botId: DEMI_BOT_ID,
                contactPhone: contact.phone,
                contactName: contact.name || undefined,
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
                text: `Template "${chosenTemplate}" enviado para ${contact.name || contact.phone}`,
              },
              status: "sent",
            });

            // Registra no GPT Maker para que o agente reconheça a conversa
            await registerInGptMaker(contact.phone, chosenTemplate, contact.name, payload.orgId);
          } catch (e) {
            console.error("[Campaign] Failed to log template dispatch:", e);
          }
        })();
      } else {
        const errorCode = data.error?.code || 0;
        const translated =
          getUserFriendlyMessage(errorCode) || data.error?.message || "Unknown error";
        const errMsg = `(#${errorCode}) ${translated}`;
        await updateContactStatus(campaignId, contact.phone, "failed", undefined, errMsg);
        failedCount++;
        console.log(`❌ Failed ${contact.phone}: ${errMsg}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Erro desconhecido";
      await updateContactStatus(campaignId, contact.phone, "failed", undefined, errMsg);
      failedCount++;
      console.error(`❌ Exception ${contact.phone}:`, err);
    }

    // ✅ Anti-ban: delay aleatório entre 7 e 63 segundos
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
