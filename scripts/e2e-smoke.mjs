// End-to-end smoke test: register a new user with the IdP, verify the email
// code, complete the OIDC dance, then open a WebSocket to the chat
// orchestrator using the resulting JWT access token. Exits 0 on success.
import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import WebSocket from 'ws';

const IDP = 'http://127.0.0.1:3300';
const ORCH_WS = 'ws://127.0.0.1:3200/v5/chat';
const RESOURCE = 'http://127.0.0.1:3200';
const CLIENT_ID = 'swirlock-chatbot-ui';
const REDIRECT_URI = 'http://localhost:4200/auth/callback';
const EMAIL = `e2e-${randomUUID().slice(0, 8)}@example.com`;
const PASSWORD = 'e2e-password-1234';

const cookies = new Map();

function setCookies(setCookieHeader) {
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const sc of list) {
    if (!sc) continue;
    const semi = sc.indexOf(';');
    const kv = semi >= 0 ? sc.slice(0, semi) : sc;
    const eq = kv.indexOf('=');
    if (eq <= 0) continue;
    cookies.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
  }
}

function cookieHeader() {
  if (cookies.size === 0) return undefined;
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function http(method, url, body, opts = {}) {
  const headers = { ...(opts.headers ?? {}) };
  const ch = cookieHeader();
  if (ch) headers.Cookie = ch;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  const res = await fetch(url, {
    method,
    headers,
    body,
    redirect: 'manual',
  });
  const sc = res.headers.getSetCookie?.();
  if (sc?.length) setCookies(sc);
  else {
    const sc2 = res.headers.get('set-cookie');
    if (sc2) setCookies(sc2);
  }
  return res;
}

function form(obj) {
  return new URLSearchParams(obj).toString();
}

function readVerificationCode(email) {
  // Read the IdP's PM2 stdout log file directly (avoids relying on pm2 on PATH).
  const logsDir = join(homedir(), '.pm2', 'logs');
  const candidates = readdirSync(logsDir).filter(
    (f) => f.startsWith('swirlock-idp-base-out') && f.endsWith('.log'),
  );
  if (candidates.length === 0) {
    throw new Error(`No PM2 log file found in ${logsDir} matching swirlock-idp-base-out-*.log`);
  }
  const re = new RegExp(
    `verification code for ${email.replace(/[.+]/g, '\\$&')}[^:]*: (\\d{6})`,
    'g',
  );
  let last = null;
  for (const f of candidates) {
    const text = readFileSync(join(logsDir, f), 'utf8');
    for (const m of text.matchAll(re)) last = m[1];
  }
  if (!last) throw new Error(`No verification code found in PM2 log for ${email}`);
  return last;
}

function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function locationOf(res) {
  const loc = res.headers.get('location');
  if (!loc) throw new Error(`Expected Location header on ${res.status} from ${res.url}`);
  return loc;
}

(async () => {
  console.log(`[e2e] using email=${EMAIL}`);
  const { verifier, challenge } = pkce();

  // 1. Authorization request
  const authUrl =
    `${IDP}/oidc/auth?` +
    new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      scope: 'openid profile offline_access',
      redirect_uri: REDIRECT_URI,
      resource: RESOURCE,
      state: 'st',
      nonce: 'n',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
  let res = await http('GET', authUrl);
  if (res.status !== 303) throw new Error(`auth: expected 303, got ${res.status}`);
  const loc1 = locationOf(res);
  const uid = loc1.replace('/interaction/', '');
  console.log(`[e2e] interaction uid=${uid}`);

  // 2. Signup
  res = await http('POST', `${IDP}/interaction/${uid}/signup`, form({
    email: EMAIL,
    password: PASSWORD,
    confirm: PASSWORD,
  }));
  if (res.status !== 303) throw new Error(`signup: expected 303, got ${res.status} (${await res.text()})`);
  const verifyUrl = locationOf(res);
  const vid = new URL(verifyUrl, IDP).searchParams.get('vid');
  if (!vid) throw new Error(`signup: no vid in redirect ${verifyUrl}`);
  console.log(`[e2e] verification id=${vid}`);

  // 3. Read code from PM2 logs
  await new Promise((r) => setTimeout(r, 800));
  const code = readVerificationCode(EMAIL);
  console.log(`[e2e] verification code=${code}`);

  // 4. Verify email
  res = await http('POST', `${IDP}/interaction/${uid}/verify-email`, form({ vid, code }));
  if (res.status !== 303) throw new Error(`verify-email: expected 303, got ${res.status}`);
  const resumeUrl = locationOf(res);
  console.log(`[e2e] resume=${resumeUrl}`);

  // 5. Resume auth (might land on consent prompt or directly redirect to client)
  res = await http('GET', resumeUrl);
  if (res.status !== 303) throw new Error(`resume: expected 303, got ${res.status}`);
  let nextLoc = locationOf(res);
  console.log(`[e2e] post-resume location=${nextLoc}`);

  // 6. If we landed on a consent interaction, confirm it.
  if (nextLoc.includes('/interaction/')) {
    const consentUid = nextLoc.split('/interaction/')[1];
    res = await http('POST', `${IDP}/interaction/${consentUid}/confirm`, '');
    if (res.status !== 303) throw new Error(`consent: expected 303, got ${res.status}`);
    const resumeAgain = locationOf(res);
    res = await http('GET', resumeAgain);
    if (res.status !== 303) throw new Error(`post-consent resume: expected 303, got ${res.status}`);
    nextLoc = locationOf(res);
    console.log(`[e2e] post-consent location=${nextLoc}`);
  }

  // 7. Final redirect should point at REDIRECT_URI with ?code=...
  const finalUrl = new URL(nextLoc);
  const codeFromIdp = finalUrl.searchParams.get('code');
  if (!codeFromIdp) throw new Error(`No authorization code in final redirect: ${nextLoc}`);
  console.log(`[e2e] auth code=${codeFromIdp.slice(0, 16)}…`);

  // 8. Exchange code for tokens
  res = await http('POST', `${IDP}/oidc/token`, form({
    grant_type: 'authorization_code',
    code: codeFromIdp,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  }));
  if (res.status !== 200) {
    throw new Error(`token: expected 200, got ${res.status} ${await res.text()}`);
  }
  const tokens = await res.json();
  console.log(`[e2e] token_type=${tokens.token_type} expires_in=${tokens.expires_in} scope=${tokens.scope}`);
  if (!tokens.access_token) throw new Error('No access_token returned');

  // 9. Decode the JWT header + payload (no verification, just inspection)
  const [h, p] = tokens.access_token.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  console.log(`[e2e] jwt header.alg=${header.alg} kid=${header.kid}`);
  console.log(`[e2e] jwt iss=${payload.iss} aud=${payload.aud} sub=${payload.sub} client_id=${payload.client_id}`);

  // 10. Open WebSocket to orchestrator with token
  console.log(`[e2e] opening orchestrator WS…`);
  const ws = new WebSocket(`${ORCH_WS}?token=${encodeURIComponent(tokens.access_token)}`);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('WS open timed out')), 5000);
    ws.on('open', () => { clearTimeout(t); resolve(); });
    ws.on('error', (err) => { clearTimeout(t); reject(err); });
    ws.on('unexpected-response', (_req, res) => {
      clearTimeout(t);
      reject(new Error(`unexpected-response from orchestrator: ${res.statusCode}`));
    });
  });
  console.log(`[e2e] WS opened — orchestrator accepted the JWT.`);
  ws.close();
  console.log(`[e2e] PASS ✅`);
})().catch((err) => {
  console.error(`[e2e] FAIL ❌ ${err?.message || err}`);
  console.error(err?.stack || '');
  process.exit(1);
});
