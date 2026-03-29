#!/usr/bin/env node
/**
 * GPT Maker Token Health Check
 * Runs daily via crontab (0 3 * * *).
 * Verifies the API key is still valid — logs a warning if not.
 *
 * NOTE: GPT Maker uses permanent API keys (no expiry, no login endpoint).
 * If the token fails, generate a new one at: https://app.gptmaker.ai/browse/developers
 */

const https = require('https');
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

const token = process.env.GPTMAKER_JWT_TOKEN;
const agentId = process.env.GPTMAKER_AGENT_ID;

if (!token || !agentId) {
  console.warn('[GPTMaker Health] Missing GPTMAKER_JWT_TOKEN or GPTMAKER_AGENT_ID');
  process.exit(0);
}

function post(url, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const res = await post(
    `https://api.gptmaker.ai/v2/agent/${agentId}/conversation`,
    { contextId: 'healthcheck-cron', prompt: 'ping' },
    { Authorization: `Bearer ${token}` }
  );

  const data = JSON.parse(res.body);

  if (res.status === 200 && data.success) {
    console.log('[GPTMaker Health] ✅ Token válido — API respondeu OK');
  } else {
    console.error('[GPTMaker Health] ⚠️ Token pode estar inválido — status:', res.status, res.body.slice(0, 200));
    console.error('[GPTMaker Health] Gere um novo token em: https://app.gptmaker.ai/browse/developers');
    console.error('[GPTMaker Health] Depois atualize GPTMAKER_JWT_TOKEN no .env e reinicie o container:');
    console.error('[GPTMaker Health]   docker compose restart smartzap');
  }
}

main().catch(e => console.error('[GPTMaker Health] Erro:', e.message));
