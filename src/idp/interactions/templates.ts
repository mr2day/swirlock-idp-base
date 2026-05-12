function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Mobile-first dark theme matching the Gigi-the-Robot persona in
 * swirlock-chatbot-ui. Tokens kept in sync with
 * `swirlock-chatbot-ui/src/app/core/personas/gigi-the-robot.persona.ts`.
 */
const STYLE = `
:root {
  --bg: #262627;
  --surface: #1f1f20;
  --surface-elevated: #2c2c2e;
  --border: rgba(255, 255, 255, 0.08);
  --text-primary: #f5f5f5;
  --text-secondary: rgba(245, 245, 245, 0.65);
  --text-muted: rgba(245, 245, 245, 0.4);
  --accent: #f5b916;
  --accent-contrast: #1a1a1b;
  --danger: #ff6b6b;
  --ok: #7ee896;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--text-primary);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  font-size: 16px;
  line-height: 1.45;
}
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
  padding: 24px;
  width: 100%;
  max-width: 420px;
}
h1 {
  margin: 0 0 4px;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.sub {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-bottom: 20px;
}
label {
  display: block;
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-top: 14px;
}
input {
  width: 100%;
  padding: 12px 14px;
  margin-top: 6px;
  border: 1px solid var(--border);
  background: var(--surface-elevated);
  color: var(--text-primary);
  border-radius: 10px;
  font: inherit;
  min-height: 44px;
}
input:focus {
  outline: none;
  border-color: var(--accent);
}
input.code {
  letter-spacing: 8px;
  font-size: 1.35rem;
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.row {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
button, .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  padding: 12px 16px;
  border: 0;
  border-radius: 10px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  font-family: inherit;
  text-decoration: none;
}
button.primary, .btn.primary {
  background: var(--accent);
  color: var(--accent-contrast);
}
button.primary:hover, .btn.primary:hover {
  filter: brightness(1.06);
}
button.secondary, .btn.secondary {
  background: var(--surface-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border);
}
button.secondary:hover, .btn.secondary:hover {
  border-color: var(--accent);
}
.err {
  color: var(--danger);
  font-size: 0.9rem;
  margin-top: 14px;
}
.info {
  color: var(--ok);
  font-size: 0.9rem;
  margin-top: 14px;
}
.alt {
  margin-top: 18px;
  font-size: 0.9rem;
  color: var(--text-secondary);
  text-align: center;
}
.alt a {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}
.alt a:hover {
  text-decoration: underline;
}
.hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 6px;
}
.scopes {
  margin: 4px 0 22px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.scope {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 14px;
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.scope-icon {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  color: var(--accent);
  margin-top: 1px;
}
.scope-text {
  color: var(--text-primary);
  font-size: 0.95rem;
}
@media (min-width: 480px) {
  body { padding: 24px; }
  .card { padding: 32px; }
  h1 { font-size: 1.5rem; }
}
`;

const HEAD = (title: string) =>
  `<meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` +
  `<title>${escape(title)}</title>` +
  `<style>${STYLE}</style>`;

export function loginPage(opts: {
  uid: string;
  clientName: string;
  email?: string;
  error?: string;
}): string {
  const uid = escape(opts.uid);
  return `<!doctype html>
<html><head>${HEAD('Sign in')}</head>
<body><div class="card">
  <h1>Sign in</h1>
  <div class="sub">${escape(opts.clientName)}</div>
  <form method="post" action="/interaction/${uid}/login">
    <label>Email
      <input name="email" type="email" autocomplete="email" autofocus required value="${escape(opts.email ?? '')}" />
    </label>
    <label>Password
      <input name="password" type="password" autocomplete="current-password" required />
    </label>
    ${opts.error ? `<div class="err">${escape(opts.error)}</div>` : ''}
    <div class="row"><button class="primary" type="submit">Sign in</button></div>
  </form>
  <div class="alt">No account? <a href="/interaction/${uid}/signup">Create one</a></div>
</div></body></html>`;
}

export function signupPage(opts: {
  uid: string;
  clientName: string;
  email?: string;
  error?: string;
}): string {
  const uid = escape(opts.uid);
  return `<!doctype html>
<html><head>${HEAD('Create account')}</head>
<body><div class="card">
  <h1>Create account</h1>
  <div class="sub">${escape(opts.clientName)}</div>
  <form method="post" action="/interaction/${uid}/signup">
    <label>Email
      <input name="email" type="email" autocomplete="email" autofocus required value="${escape(opts.email ?? '')}" />
      <div class="hint">We will send a verification code to this address.</div>
    </label>
    <label>Password
      <input name="password" type="password" autocomplete="new-password" required minlength="8" />
      <div class="hint">At least 8 characters.</div>
    </label>
    <label>Confirm password
      <input name="confirm" type="password" autocomplete="new-password" required minlength="8" />
    </label>
    ${opts.error ? `<div class="err">${escape(opts.error)}</div>` : ''}
    <div class="row"><button class="primary" type="submit">Create account</button></div>
  </form>
  <div class="alt">Already have an account? <a href="/interaction/${uid}">Sign in</a></div>
</div></body></html>`;
}

export function verifyEmailPage(opts: {
  uid: string;
  clientName: string;
  email: string;
  verificationId: string;
  error?: string;
  info?: string;
}): string {
  const uid = escape(opts.uid);
  const vid = escape(opts.verificationId);
  return `<!doctype html>
<html><head>${HEAD('Confirm your email')}</head>
<body><div class="card">
  <h1>Confirm your email</h1>
  <div class="sub">We sent a 6-digit code to <strong>${escape(opts.email)}</strong> for ${escape(opts.clientName)}.</div>
  <form method="post" action="/interaction/${uid}/verify-email">
    <input type="hidden" name="vid" value="${vid}" />
    <label>Verification code
      <input class="code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" minlength="6" autocomplete="one-time-code" autofocus required />
    </label>
    ${opts.error ? `<div class="err">${escape(opts.error)}</div>` : ''}
    ${opts.info ? `<div class="info">${escape(opts.info)}</div>` : ''}
    <div class="row"><button class="primary" type="submit">Confirm</button></div>
  </form>
  <form method="post" action="/interaction/${uid}/resend-code" style="margin-top:8px;">
    <input type="hidden" name="vid" value="${vid}" />
    <div class="row"><button class="secondary" type="submit">Resend code</button></div>
  </form>
</div></body></html>`;
}

/**
 * Maps raw OIDC scope keys to human-readable, non-technical explanations
 * for the consent screen. Unknown scopes fall through to their raw label
 * so the user still sees *something* rather than nothing.
 */
function describeScope(scope: string): string {
  switch (scope) {
    case 'openid':
      return 'Confirm who you are when you sign in.';
    case 'profile':
      return 'See your email address.';
    case 'offline_access':
      return 'Stay signed in across visits without having to log in every time.';
    case 'email':
      return 'See your email address.';
    default:
      return scope;
  }
}

const CHECK_ICON = `<svg class="scope-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function consentPage(opts: {
  uid: string;
  clientName: string;
  scopes: string[];
}): string {
  const items = opts.scopes.length
    ? `<ul class="scopes">${opts.scopes
        .map(
          (s) =>
            `<li class="scope">${CHECK_ICON}<span class="scope-text">${escape(describeScope(s))}</span></li>`,
        )
        .join('')}</ul>`
    : '<p class="sub">No additional permissions requested.</p>';
  return `<!doctype html>
<html><head>${HEAD('Authorize')}</head>
<body><div class="card">
  <h1>Allow ${escape(opts.clientName)} to:</h1>
  ${items}
  <form method="post" action="/interaction/${escape(opts.uid)}/confirm">
    <div class="row">
      <button class="primary" type="submit">Allow</button>
      <button class="secondary" type="submit" formaction="/interaction/${escape(opts.uid)}/abort">Deny</button>
    </div>
  </form>
</div></body></html>`;
}

/**
 * RP-initiated logout confirmation. `form` is the oidc-provider-supplied
 * form (id="op.logoutForm") that posts to /session/end/confirm with an
 * xsrf field. Only "Yes" submits that form (which actually ends the
 * session). "No" navigates the browser to `stayUrl` so neither the IdP
 * session nor the relying party's local state is touched — keeping the
 * user genuinely signed in.
 */
export function logoutPage(opts: {
  clientName: string;
  form: string;
  stayUrl: string;
}): string {
  return `<!doctype html>
<html><head>${HEAD('Sign out')}</head>
<body><div class="card">
  <h1>Sign out?</h1>
  <div class="sub">You will be signed out of ${escape(opts.clientName)}.</div>
  ${opts.form}
  <div class="row">
    <button class="primary" form="op.logoutForm" type="submit" name="logout" value="yes">Yes, sign me out</button>
  </div>
  <div class="row" style="margin-top:10px;">
    <a class="btn secondary" href="${escape(opts.stayUrl)}">No, stay signed in</a>
  </div>
</div></body></html>`;
}
