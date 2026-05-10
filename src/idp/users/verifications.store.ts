import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { db } from '../storage/db';

const CODE_TTL_SEC = 10 * 60;
const MAX_ATTEMPTS = 5;

export interface VerificationRow {
  id: string;
  account_id: string;
  code_hash: string;
  attempts: number;
  expires_at: number;
  created_at: number;
  consumed_at: number | null;
}

function generateCode(): string {
  // 6-digit numeric, leading zeros preserved.
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, '0');
}

/**
 * Issue a new verification code for an account. Invalidates any prior
 * unconsumed codes for the same account.
 */
export async function issueCode(accountId: string): Promise<{
  verificationId: string;
  code: string;
  expiresAt: Date;
}> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + CODE_TTL_SEC;
  const id = randomUUID();

  db()
    .prepare(
      `UPDATE email_verifications SET consumed_at = ?
       WHERE account_id = ? AND consumed_at IS NULL`,
    )
    .run(now, accountId);

  db()
    .prepare(
      `INSERT INTO email_verifications
         (id, account_id, code_hash, attempts, expires_at, created_at, consumed_at)
       VALUES (?, ?, ?, 0, ?, ?, NULL)`,
    )
    .run(id, accountId, codeHash, expiresAt, now);

  return { verificationId: id, code, expiresAt: new Date(expiresAt * 1000) };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'expired' | 'wrong_code' | 'too_many_attempts' };

export async function verifyCode(
  verificationId: string,
  code: string,
): Promise<VerifyResult> {
  const row = db()
    .prepare(
      `SELECT * FROM email_verifications WHERE id = ? AND consumed_at IS NULL`,
    )
    .get(verificationId) as VerificationRow | undefined;
  if (!row) return { ok: false, reason: 'not_found' };
  const now = Math.floor(Date.now() / 1000);
  if (row.expires_at < now) return { ok: false, reason: 'expired' };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
  const ok = await bcrypt.compare(code.trim(), row.code_hash);
  if (!ok) {
    db()
      .prepare(`UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?`)
      .run(verificationId);
    return { ok: false, reason: 'wrong_code' };
  }
  db()
    .prepare(`UPDATE email_verifications SET consumed_at = ? WHERE id = ?`)
    .run(now, verificationId);
  return { ok: true };
}

export function getVerification(id: string): VerificationRow | null {
  return (
    (db()
      .prepare(`SELECT * FROM email_verifications WHERE id = ?`)
      .get(id) as VerificationRow | undefined) ?? null
  );
}
