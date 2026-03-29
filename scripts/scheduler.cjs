#!/usr/bin/env node
/**
 * SmartZap Campaign Scheduler
 * Runs every minute via crontab.
 * Finds SCHEDULED campaigns whose scheduled_at <= now() and dispatches them.
 */

const { createClient } = require('/home/ubuntu/apps/smartzap/node_modules/@supabase/supabase-js/dist/main/index.js');
const https = require('https');
const http = require('http');

// Load .env manually
const fs = require('fs');
const envPath = '/home/ubuntu/apps/smartzap/.env';
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length > 0 && !process.env[key]) {
      process.env[key] = vals.join('=').trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002').trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('[Scheduler] Missing Supabase config');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const now = new Date().toISOString();

  const { data: due, error } = await supabase
    .from('campaigns')
    .select('id, organization_id, template_name, template_variables, message_variants')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now);

  if (error) { console.error('[Scheduler] Query error:', error.message); process.exit(1); }
  if (!due || due.length === 0) { console.log('[Scheduler] No campaigns due.'); return; }

  for (const campaign of due) {
    try {
      // Optimistic lock: mark as sending
      const { error: updateErr } = await supabase
        .from('campaigns')
        .update({ status: 'sending', started_at: now })
        .eq('id', campaign.id)
        .eq('status', 'scheduled');

      if (updateErr) { console.error('[Scheduler] Update error:', updateErr.message); continue; }

      // Load pending contacts
      const { data: contacts } = await supabase
        .from('campaign_contacts').select('phone, name')
        .eq('campaign_id', campaign.id).eq('status', 'pending');

      if (!contacts || contacts.length === 0) {
        console.log('[Scheduler] No pending contacts for', campaign.id, '— marking completed');
        await supabase.from('campaigns').update({ status: 'completed', completed_at: now }).eq('id', campaign.id);
        continue;
      }

      // Load template names
      const { data: tplRows } = await supabase
        .from('campaign_templates').select('template_name').eq('campaign_id', campaign.id);

      const templateNames = tplRows && tplRows.length > 0
        ? tplRows.map(r => r.template_name)
        : (campaign.message_variants && campaign.message_variants.length > 0)
          ? campaign.message_variants
          : campaign.template_name ? [campaign.template_name] : [];

      if (templateNames.length === 0) {
        console.error('[Scheduler] No templates for campaign', campaign.id);
        continue;
      }

      const processUrl = appUrl.replace('https://smartzap.optivra.digital', 'http://localhost:3002') + '/api/campaign/process';
      const payload = {
        campaignId: campaign.id,
        templateName: templateNames[0],
        templateNames,
        contacts,
        templateVariables: campaign.template_variables || [],
        phoneNumberId: '', accessToken: '',
        orgId: campaign.organization_id
      };

      // Fire and don't wait (campaigns run for hours)
      postJson(processUrl, payload)
        .then(r => console.log('[Scheduler] Fired', campaign.id, '- Process responded:', r.status))
        .catch(e => console.error('[Scheduler] Failed to fire', campaign.id, e.message));

      console.log('[Scheduler] ✅', campaign.id, '- dispatching', contacts.length, 'contacts, templates:', templateNames.join(', '));
    } catch (e) {
      console.error('[Scheduler] Exception for', campaign.id, e.message);
    }
  }
}

main().catch(e => { console.error('[Scheduler] Fatal:', e); process.exit(1); });
