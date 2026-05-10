import { generateKeyPairSync, randomUUID } from 'crypto';
import { db } from '../storage/db';

export interface JwksRecord {
  keys: Record<string, unknown>[];
}

interface JwksRow {
  kid: string;
  alg: string;
  use: string;
  jwk_json: string;
}

export function loadOrGenerateJwks(): JwksRecord {
  const rows = db()
    .prepare(`SELECT kid, alg, use, jwk_json FROM jwks WHERE active = 1`)
    .all() as JwksRow[];
  if (rows.length > 0) {
    return { keys: rows.map((r) => JSON.parse(r.jwk_json) as Record<string, unknown>) };
  }
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = privateKey.export({ format: 'jwk' }) as Record<string, unknown>;
  jwk.use = 'sig';
  jwk.alg = 'RS256';
  jwk.kid = randomUUID();
  db()
    .prepare(
      `INSERT INTO jwks (kid, alg, use, jwk_json, active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
    )
    .run(
      jwk.kid as string,
      jwk.alg as string,
      jwk.use as string,
      JSON.stringify(jwk),
      Math.floor(Date.now() / 1000),
    );
  return { keys: [jwk] };
}

export function loadOrGenerateCookieKeys(): string[] {
  const rows = db()
    .prepare(`SELECT secret FROM cookie_keys ORDER BY id`)
    .all() as { secret: string }[];
  if (rows.length >= 2) {
    return rows.map((r) => r.secret);
  }
  const insert = db().prepare(
    `INSERT INTO cookie_keys (secret, created_at) VALUES (?, ?)`,
  );
  const now = Math.floor(Date.now() / 1000);
  const keys: string[] = rows.map((r) => r.secret);
  while (keys.length < 2) {
    const s = randomUUID() + randomUUID();
    insert.run(s, now);
    keys.push(s);
  }
  return keys;
}
