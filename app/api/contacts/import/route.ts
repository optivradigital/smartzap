/**
 * POST /api/contacts/import
 * Upload CSV de contatos para uma campanha ou lista de contatos.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireManager } from "@/lib/role-guard";

// Normaliza número para formato internacional (ex: 5511999887766)
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  if (digits.length === 10 || digits.length === 11) {
    return "55" + digits;
  }
  return digits;
}

// Parse CSV com suporte a separador vírgula ou ponto-e-vírgula
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) =>
    h.trim().toLowerCase().replace(/['"]/g, "")
  );
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(sep).map((v) => v.trim().replace(/^['"]|['"]$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }
  return rows;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export async function POST(request: NextRequest) {
  const { user, error } = await requireManager();
  if (error) return error;

  const orgId = user!.organizationId || null;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const campaignId = formData.get("campaignId") as string | null;
  const phoneColInput = formData.get("phoneColumn") as string | null;
  const nameColInput = formData.get("nameColumn") as string | null;
  const phoneCol = phoneColInput ? phoneColInput.toLowerCase() : null;
  const nameCol = nameColInput ? nameColInput.toLowerCase() : null;

  if (!file) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".csv") && !fileName.endsWith(".txt")) {
    return NextResponse.json(
      { error: "Formato não suportado. Use CSV (.csv)." },
      { status: 400 }
    );
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Arquivo vazio ou inválido" }, { status: 400 });
  }

  const headers = Object.keys(rows[0]);

  const phoneField =
    phoneCol ||
    headers.find((h) =>
      ["phone", "telefone", "tel", "celular", "whatsapp", "numero"].includes(h)
    ) ||
    headers[0];

  const nameField =
    nameCol ||
    headers.find((h) => ["name", "nome", "cliente", "contato"].includes(h)) ||
    null;

  // Processa contatos
  const contacts: { phone: string; name: string }[] = [];
  const seen = new Set<string>();
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const row of rows) {
    const rawPhone = row[phoneField] || "";
    const phone = normalizePhone(rawPhone);
    if (!phone) { invalidCount++; continue; }
    if (seen.has(phone)) { duplicateCount++; continue; }
    seen.add(phone);
    const name = nameField ? (row[nameField] || "") : "";
    contacts.push({ phone, name });
  }

  const now = new Date().toISOString();

  if (contacts.length > 0) {
    // Salva na tabela contacts
    const contactRows = contacts.map((c) => ({
      id: generateId(),
      phone: c.phone,
      name: c.name || null,
      organization_id: orgId,
      created_at: now,
    }));

    const { error: upsertError } = await supabase
      .from("contacts")
      .upsert(contactRows, { onConflict: "phone,organization_id" });
    if (upsertError) console.error("[contacts/import] upsert error:", upsertError);

    // Vincula à campanha se fornecida
    if (campaignId) {
      const ccRows = contacts.map((c) => ({
        id: generateId(),
        campaign_id: campaignId,
        phone: c.phone,
        name: c.name || "",
        status: "pending",
        created_at: now,
      }));

      const { error: ccError } = await supabase
        .from("campaign_contacts")
        .upsert(ccRows, { onConflict: "campaign_id,phone" });
      if (ccError) console.error("[contacts/import] campaign_contacts error:", ccError);
    }
  }

  return NextResponse.json({
    total: rows.length,
    imported: contacts.length,
    invalid: invalidCount,
    duplicates: duplicateCount,
    contacts: contacts.map((c) => ({ phone: c.phone, name: c.name })),
  });
}

// PUT: retorna colunas disponíveis para mapeamento (preview antes de importar)
export async function PUT(request: NextRequest) {
  const { error } = await requireManager();
  if (error) return error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Arquivo vazio" }, { status: 400 });
  }

  const headers = Object.keys(rows[0]);
  const preview = rows.slice(0, 3);

  return NextResponse.json({ headers, preview, total: rows.length });
}
