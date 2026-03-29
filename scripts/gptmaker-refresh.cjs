#!/usr/bin/env node
/**
 * GPT Maker JWT Token Refresh Script
 * Roda diariamente via crontab para manter o token atualizado.
 * 
 * Usage: node scripts/gptmaker-refresh.cjs
 */

const https = require('https');
const fs = require('fs');

// Load .env
const envPath = '/home/ubuntu/apps/smartzap/.env';
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length > 0 && !process.env[key]) {
      process.env[key] = vals.join('=').trim();
    }
  });
}

const email = process.env.GPTMAKER_EMAIL;
const password = process.env.GPTMAKER_PASSWORD;
const loginUrl = process.env.GPTMAKER_LOGIN_URL || 'https://api.gptmaker.ai/v2/user/login';

if (!email || !password) {
  console.error('[GPTMaker Refresh] Missing GPTMAKER_EMAIL or GPTMAKER_PASSWORD in .env');
  console.error('Add to .env: GPTMAKER_EMAIL=juarezfonseca@optivra.digital');
  console.error('             GPTMAKER_PASSWORD=your_password');
  process.exit(1);
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, port: 443,
      path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
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

function updateEnvFile(key, value) {
  let content = fs.readFileSync(envPath, 'utf8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(envPath, content);
}

async function main() {
  console.log('[GPTMaker Refresh] Logging in as', email);
  
  const res = await postJson(loginUrl, { email, password });
  
  if (res.status !== 200 && res.status !== 201) {
    console.error('[GPTMaker Refresh] Login failed:', res.status, res.body.slice(0, 200));
    process.exit(1);
  }
  
  const data = JSON.parse(res.body);
  const newToken = data.token || data.accessToken || data.jwt || data.data?.token;
  
  if (!newToken) {
    console.error('[GPTMaker Refresh] No token in response:', res.body.slice(0, 200));
    process.exit(1);
  }
  
  // Decode expiry
  try {
    const payload = JSON.parse(Buffer.from(newToken.split('.')[1], 'base64').toString());
    const expDate = new Date(payload.exp * 1000).toISOString();
    console.log('[GPTMaker Refresh] ✅ Token refreshed, expires:', expDate);
  } catch { console.log('[GPTMaker Refresh] ✅ Token refreshed'); }
  
  // Update .env
  updateEnvFile('GPTMAKER_JWT_TOKEN', newToken);
  console.log('[GPTMaker Refresh] Token saved to .env');
  
  // TODO: also update per-org Redis keys if needed
  // The next campaign dispatch will pick up the new token from env
}

main().catch(e => { console.error('[GPTMaker Refresh] Fatal:', e.message); process.exit(1); });
