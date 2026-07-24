import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/campaign/scheduler?token=SCHEDULER_SECRET
 * Called every minute by EC2 crontab.
 * Finds campaigns with status='scheduled' and scheduled_at <= now(),
 * then fires dispatch to the process route for each.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== process.env.SCHEDULER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Find campaigns ready to run
  const { data: due, error } = await supabase
    .from("campaigns")
    .select("id, organization_id, template_name, template_variables, variable_column_map, message_variants, header_media_url")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  if (error) {
    console.error("[Scheduler] Query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ fired: 0 });
  }

  const fired: string[] = [];
  const failed: string[] = [];

  for (const campaign of due) {
    try {
      // Mark as sending immediately to prevent double-fire
      await supabase
        .from("campaigns")
        .update({ status: "sending", started_at: now })
        .eq("id", campaign.id)
        .eq("status", "scheduled"); // optimistic lock

      // Load pending contacts
      const { data: contactRows } = await supabase
        .from("campaign_contacts")
        .select("phone, name, variables")
        .eq("campaign_id", campaign.id)
        .eq("status", "pending");

      if (!contactRows || contactRows.length === 0) {
        console.log(`[Scheduler] Campaign ${campaign.id} has no pending contacts — marking completed`);
        await supabase.from("campaigns").update({ status: "completed", completed_at: now }).eq("id", campaign.id);
        continue;
      }

      // Load multi-template names (campaign_templates table first, then fallback)
      const { data: tplRows } = await supabase
        .from("campaign_templates")
        .select("template_name")
        .eq("campaign_id", campaign.id);

      const templateNames: string[] =
        tplRows && tplRows.length > 0
          ? tplRows.map((r: { template_name: string }) => r.template_name)
          : campaign.message_variants?.length
          ? campaign.message_variants
          : campaign.template_name
          ? [campaign.template_name]
          : [];

      if (templateNames.length === 0) {
        console.error(`[Scheduler] Campaign ${campaign.id} has no templates — skipping`);
        failed.push(campaign.id);
        continue;
      }

      // Fire to process route
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3002";
      const processUrl = `${baseUrl}/api/campaign/process`;

      const payload = {
        campaignId: campaign.id,
        templateName: templateNames[0],
        templateNames,
        contacts: contactRows.map((c: { phone: string; name: string; variables: Record<string, string> | null }) => ({
          phone: c.phone,
          name: c.name,
          vars: c.variables ?? undefined,
        })),
        templateVariables: campaign.template_variables ?? [],
        variableColumnMap: campaign.variable_column_map ?? undefined,
        phoneNumberId: "", // process route loads from Redis via orgId
        accessToken: "",   // process route loads from Redis via orgId
        orgId: campaign.organization_id,
        headerMediaUrl: campaign.header_media_url || undefined,
      };

      // Fire-and-forget (don't await — campaigns can run for hours)
      fetch(processUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((e) => console.error(`[Scheduler] Failed to fire campaign ${campaign.id}:`, e));

      fired.push(campaign.id);
      console.log(`[Scheduler] ✅ Fired campaign ${campaign.id} (${contactRows.length} contacts, templates: ${templateNames.join(", ")})`);
    } catch (e) {
      console.error(`[Scheduler] Exception for campaign ${campaign.id}:`, e);
      failed.push(campaign.id);
    }
  }

  return NextResponse.json({ fired: fired.length, campaigns: fired, failed });
}
