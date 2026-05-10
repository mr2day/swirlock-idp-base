import type { Adapter, AdapterPayload } from 'oidc-provider';
import { clientRowToMetadata, getClient } from '../clients/client.store';
import { db } from './db';

interface Row {
  payload: string;
  consumed_at: number | null;
  expires_at: number;
}

export class SqliteAdapter implements Adapter {
  constructor(private readonly name: string) {}

  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    if (this.name === 'Client') {
      // Clients are managed externally via the CLI. Ignore writes from oidc-provider.
      return;
    }
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    db()
      .prepare(
        `INSERT INTO oidc_records (model, id, payload, grant_id, user_code, uid, consumed_at, expires_at)
         VALUES (@model, @id, @payload, @grantId, @userCode, @uid, NULL, @expiresAt)
         ON CONFLICT(model, id) DO UPDATE SET
           payload=excluded.payload,
           grant_id=excluded.grant_id,
           user_code=excluded.user_code,
           uid=excluded.uid,
           expires_at=excluded.expires_at`,
      )
      .run({
        model: this.name,
        id,
        payload: JSON.stringify(payload),
        grantId: payload.grantId ?? null,
        userCode: (payload as AdapterPayload & { userCode?: string }).userCode ?? null,
        uid: payload.uid ?? null,
        expiresAt,
      });
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    if (this.name === 'Client') {
      const row = getClient(id);
      if (!row) return undefined;
      return clientRowToMetadata(row) as unknown as AdapterPayload;
    }
    const row = db()
      .prepare(
        `SELECT payload, consumed_at, expires_at FROM oidc_records WHERE model = ? AND id = ?`,
      )
      .get(this.name, id) as Row | undefined;
    return this.materialize(row);
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const row = db()
      .prepare(
        `SELECT payload, consumed_at, expires_at FROM oidc_records WHERE model = ? AND uid = ?`,
      )
      .get(this.name, uid) as Row | undefined;
    return this.materialize(row);
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const row = db()
      .prepare(
        `SELECT payload, consumed_at, expires_at FROM oidc_records WHERE model = ? AND user_code = ?`,
      )
      .get(this.name, userCode) as Row | undefined;
    return this.materialize(row);
  }

  async consume(id: string): Promise<void> {
    if (this.name === 'Client') return;
    db()
      .prepare(
        `UPDATE oidc_records SET consumed_at = ? WHERE model = ? AND id = ?`,
      )
      .run(Math.floor(Date.now() / 1000), this.name, id);
  }

  async destroy(id: string): Promise<void> {
    if (this.name === 'Client') return;
    db()
      .prepare(`DELETE FROM oidc_records WHERE model = ? AND id = ?`)
      .run(this.name, id);
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    db().prepare(`DELETE FROM oidc_records WHERE grant_id = ?`).run(grantId);
  }

  private materialize(row: Row | undefined): AdapterPayload | undefined {
    if (!row) return undefined;
    if (row.expires_at * 1000 < Date.now()) return undefined;
    const payload = JSON.parse(row.payload) as AdapterPayload;
    if (row.consumed_at) {
      (payload as AdapterPayload & { consumed?: number }).consumed = row.consumed_at;
    }
    return payload;
  }
}
