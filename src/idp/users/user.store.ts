import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { db } from '../storage/db';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

export interface AccountRow {
  id: string;
  client_id: string;
  email: string;
  password_hash: string;
  email_verified_at: number | null;
  created_at: number;
}

export interface Account {
  accountId: string;
  claims(): Promise<Record<string, unknown>>;
}

function readById(id: string): AccountRow | null {
  return (
    (db()
      .prepare(`SELECT * FROM accounts WHERE id = ?`)
      .get(id) as AccountRow | undefined) ?? null
  );
}

function readByClientAndEmail(clientId: string, email: string): AccountRow | null {
  return (
    (db()
      .prepare(`SELECT * FROM accounts WHERE client_id = ? AND email = ?`)
      .get(clientId, email.toLowerCase()) as AccountRow | undefined) ?? null
  );
}

export function getAccountById(id: string): AccountRow | null {
  return readById(id);
}

export function getAccountByClientAndEmail(
  clientId: string,
  email: string,
): AccountRow | null {
  return readByClientAndEmail(clientId, email);
}

export type CreatePendingResult =
  | { ok: true; account: AccountRow }
  | { ok: false; error: 'email_invalid' | 'password_too_short' | 'email_taken' };

/**
 * Create a new account in the *pending* (unverified) state.
 * Per-client uniqueness on email is enforced by the schema.
 */
export async function createPendingAccount(opts: {
  clientId: string;
  email: string;
  password: string;
}): Promise<CreatePendingResult> {
  const email = opts.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'email_invalid' };
  if (opts.password.length < MIN_PASSWORD_LEN) {
    return { ok: false, error: 'password_too_short' };
  }
  const existing = readByClientAndEmail(opts.clientId, email);
  if (existing) {
    if (existing.email_verified_at) return { ok: false, error: 'email_taken' };
    // Existing pending account with same (client_id, email): replace its password
    // hash so users can recover from a forgotten signup-time password.
    const hash = await bcrypt.hash(opts.password, 12);
    db()
      .prepare(`UPDATE accounts SET password_hash = ? WHERE id = ?`)
      .run(hash, existing.id);
    return { ok: true, account: { ...existing, password_hash: hash } };
  }
  const hash = await bcrypt.hash(opts.password, 12);
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  db()
    .prepare(
      `INSERT INTO accounts (id, client_id, email, password_hash, email_verified_at, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
    )
    .run(id, opts.clientId, email, hash, now);
  const account = readById(id);
  if (!account) throw new Error('Failed to read back account after insert.');
  return { ok: true, account };
}

export async function verifyAccountPassword(opts: {
  clientId: string;
  email: string;
  password: string;
}): Promise<AccountRow | null> {
  const account = readByClientAndEmail(opts.clientId, opts.email.trim().toLowerCase());
  if (!account) return null;
  const ok = await bcrypt.compare(opts.password, account.password_hash);
  return ok ? account : null;
}

export function markEmailVerified(accountId: string): void {
  db()
    .prepare(`UPDATE accounts SET email_verified_at = ? WHERE id = ?`)
    .run(Math.floor(Date.now() / 1000), accountId);
}

export async function findAccount(
  ctx: { oidc?: { session?: { destroy?: () => Promise<void> } } } | unknown,
  sub: string,
): Promise<Account | undefined> {
  const row = readById(sub);
  if (!row) {
    // Session's accountId references an account that no longer exists
    // (cascade-deleted client, manual deletion, ...). Destroy the
    // session so the consent / interaction pipeline doesn't crash on
    // a half-populated `oidc.session` and instead routes the user to
    // a fresh login prompt.
    const sess = (ctx as { oidc?: { session?: { destroy?: () => Promise<void> } } })
      ?.oidc?.session;
    if (typeof sess?.destroy === 'function') {
      try {
        await sess.destroy();
      } catch {
        /* best-effort; oidc-provider will still drop the cookie */
      }
    }
    return undefined;
  }
  return {
    accountId: row.id,
    async claims() {
      return {
        sub: row.id,
        email: row.email,
        email_verified: row.email_verified_at !== null,
      };
    },
  };
}

/**
 * Admin-side helper: upsert a verified account directly (no email loop).
 * Used by the seed script for bootstrapping.
 */
export async function upsertVerifiedAccount(opts: {
  clientId: string;
  email: string;
  password: string;
}): Promise<AccountRow> {
  const email = opts.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error(`Invalid email "${email}".`);
  if (opts.password.length < MIN_PASSWORD_LEN) {
    throw new Error(`Password too short (min ${MIN_PASSWORD_LEN} chars).`);
  }
  const hash = await bcrypt.hash(opts.password, 12);
  const now = Math.floor(Date.now() / 1000);
  const existing = readByClientAndEmail(opts.clientId, email);
  if (existing) {
    db()
      .prepare(
        `UPDATE accounts SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?`,
      )
      .run(hash, now, existing.id);
    return readById(existing.id)!;
  }
  const id = randomUUID();
  db()
    .prepare(
      `INSERT INTO accounts (id, client_id, email, password_hash, email_verified_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, opts.clientId, email, hash, now, now);
  return readById(id)!;
}
