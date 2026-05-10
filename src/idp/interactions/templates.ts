function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLE = `
body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; background:#0f1115; color:#e8e8ea; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
.card { background:#1a1d24; padding:32px; border-radius:12px; min-width:340px; max-width:400px; box-shadow:0 8px 32px rgba(0,0,0,.4); }
h1 { margin:0 0 4px; font-size:1.2rem; }
.sub { color:#9aa0a6; font-size:.9rem; margin-bottom:20px; }
label { display:block; font-size:.85rem; color:#bdc1c6; margin-top:12px; }
input { width:100%; box-sizing:border-box; padding:10px; border:1px solid #2c3140; background:#11141b; color:#e8e8ea; border-radius:6px; margin-top:4px; font:inherit; }
input.code { letter-spacing:8px; font-size:1.3rem; text-align:center; font-family:monospace; }
button { width:100%; padding:11px; border:0; border-radius:6px; font-weight:600; cursor:pointer; font:inherit; }
button.primary { background:#4f7cff; color:#fff; }
button.secondary { background:#2c3140; color:#e8e8ea; }
button.link { background:transparent; color:#7ea0ff; padding:4px; font-weight:500; width:auto; }
button.link:hover { text-decoration:underline; }
.row { display:flex; gap:8px; margin-top:20px; }
.err { color:#ff6b6b; font-size:.85rem; margin-top:14px; }
.info { color:#7ee896; font-size:.85rem; margin-top:14px; }
.alt { margin-top:16px; font-size:.85rem; color:#9aa0a6; text-align:center; }
.alt a { color:#7ea0ff; text-decoration:none; }
.alt a:hover { text-decoration:underline; }
.hint { font-size:.75rem; color:#9aa0a6; margin-top:4px; }
ul { padding-left:20px; color:#bdc1c6; }
`;

export function loginPage(opts: {
  uid: string;
  clientName: string;
  email?: string;
  error?: string;
}): string {
  const uid = escape(opts.uid);
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Sign in</title><style>${STYLE}</style></head>
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
<html><head><meta charset="utf-8"><title>Create account</title><style>${STYLE}</style></head>
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
<html><head><meta charset="utf-8"><title>Confirm your email</title><style>${STYLE}</style></head>
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

export function consentPage(opts: { uid: string; clientName: string; scopes: string[] }): string {
  const items = opts.scopes.length
    ? `<ul>${opts.scopes.map((s) => `<li>${escape(s)}</li>`).join('')}</ul>`
    : '<p>No additional permissions requested.</p>';
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Authorize</title><style>${STYLE}</style></head>
<body><div class="card">
  <h1>Authorize ${escape(opts.clientName)}?</h1>
  ${items}
  <form method="post" action="/interaction/${escape(opts.uid)}/confirm">
    <div class="row">
      <button class="primary" type="submit">Allow</button>
      <button class="secondary" type="submit" formaction="/interaction/${escape(opts.uid)}/abort">Deny</button>
    </div>
  </form>
</div></body></html>`;
}
