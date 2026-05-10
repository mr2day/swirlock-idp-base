import { db } from '../storage/db';

export interface ClientRow {
  client_id: string;
  client_name: string;
  application_type: 'web' | 'native';
  token_endpoint_auth_method:
    | 'none'
    | 'client_secret_basic'
    | 'client_secret_post'
    | 'client_secret_jwt'
    | 'private_key_jwt';
  client_secret_hash: string | null;
  grant_types: string[];
  response_types: string[];
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  scope: string;
  resource: string | null;
  created_at: number;
  updated_at: number;
}

interface DbRow {
  client_id: string;
  client_name: string;
  application_type: string;
  token_endpoint_auth_method: string;
  client_secret_hash: string | null;
  grant_types: string;
  response_types: string;
  redirect_uris: string;
  post_logout_redirect_uris: string | null;
  scope: string;
  resource: string | null;
  created_at: number;
  updated_at: number;
}

function toRow(r: DbRow): ClientRow {
  return {
    client_id: r.client_id,
    client_name: r.client_name,
    application_type: r.application_type as ClientRow['application_type'],
    token_endpoint_auth_method: r.token_endpoint_auth_method as ClientRow['token_endpoint_auth_method'],
    client_secret_hash: r.client_secret_hash,
    grant_types: JSON.parse(r.grant_types) as string[],
    response_types: JSON.parse(r.response_types) as string[],
    redirect_uris: JSON.parse(r.redirect_uris) as string[],
    post_logout_redirect_uris: r.post_logout_redirect_uris
      ? (JSON.parse(r.post_logout_redirect_uris) as string[])
      : [],
    scope: r.scope,
    resource: r.resource,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function getClient(clientId: string): ClientRow | null {
  const row = db()
    .prepare(`SELECT * FROM clients WHERE client_id = ?`)
    .get(clientId) as DbRow | undefined;
  return row ? toRow(row) : null;
}

export function listClients(): ClientRow[] {
  const rows = db()
    .prepare(`SELECT * FROM clients ORDER BY client_id`)
    .all() as DbRow[];
  return rows.map(toRow);
}

export interface UpsertClientInput {
  client_id: string;
  client_name: string;
  application_type?: ClientRow['application_type'];
  token_endpoint_auth_method?: ClientRow['token_endpoint_auth_method'];
  client_secret_hash?: string | null;
  grant_types?: string[];
  response_types?: string[];
  redirect_uris: string[];
  post_logout_redirect_uris?: string[];
  scope?: string;
  resource?: string | null;
}

export function upsertClient(input: UpsertClientInput): ClientRow {
  const now = Math.floor(Date.now() / 1000);
  const grant_types = input.grant_types ?? ['authorization_code', 'refresh_token'];
  const response_types = input.response_types ?? ['code'];
  const application_type = input.application_type ?? 'web';
  const token_endpoint_auth_method = input.token_endpoint_auth_method ?? 'none';
  const scope = input.scope ?? 'openid profile offline_access';
  db()
    .prepare(
      `INSERT INTO clients (
         client_id, client_name, application_type, token_endpoint_auth_method,
         client_secret_hash, grant_types, response_types, redirect_uris,
         post_logout_redirect_uris, scope, resource, created_at, updated_at
       ) VALUES (
         @client_id, @client_name, @application_type, @token_endpoint_auth_method,
         @client_secret_hash, @grant_types, @response_types, @redirect_uris,
         @post_logout_redirect_uris, @scope, @resource, @created_at, @updated_at
       )
       ON CONFLICT(client_id) DO UPDATE SET
         client_name = excluded.client_name,
         application_type = excluded.application_type,
         token_endpoint_auth_method = excluded.token_endpoint_auth_method,
         client_secret_hash = excluded.client_secret_hash,
         grant_types = excluded.grant_types,
         response_types = excluded.response_types,
         redirect_uris = excluded.redirect_uris,
         post_logout_redirect_uris = excluded.post_logout_redirect_uris,
         scope = excluded.scope,
         resource = excluded.resource,
         updated_at = excluded.updated_at`,
    )
    .run({
      client_id: input.client_id,
      client_name: input.client_name,
      application_type,
      token_endpoint_auth_method,
      client_secret_hash: input.client_secret_hash ?? null,
      grant_types: JSON.stringify(grant_types),
      response_types: JSON.stringify(response_types),
      redirect_uris: JSON.stringify(input.redirect_uris),
      post_logout_redirect_uris: input.post_logout_redirect_uris
        ? JSON.stringify(input.post_logout_redirect_uris)
        : null,
      scope,
      resource: input.resource ?? null,
      created_at: now,
      updated_at: now,
    });
  const created = getClient(input.client_id);
  if (!created) throw new Error('Failed to read back client after upsert.');
  return created;
}

export function removeClient(clientId: string): boolean {
  const info = db().prepare(`DELETE FROM clients WHERE client_id = ?`).run(clientId);
  return info.changes > 0;
}

export interface ClientMetadataPayload {
  client_id: string;
  client_name: string;
  application_type: string;
  token_endpoint_auth_method: string;
  client_secret?: string;
  grant_types: string[];
  response_types: string[];
  redirect_uris: string[];
  post_logout_redirect_uris?: string[];
  scope: string;
}

export function clientRowToMetadata(row: ClientRow): ClientMetadataPayload {
  const meta: ClientMetadataPayload = {
    client_id: row.client_id,
    client_name: row.client_name,
    application_type: row.application_type,
    token_endpoint_auth_method: row.token_endpoint_auth_method,
    grant_types: row.grant_types,
    response_types: row.response_types,
    redirect_uris: row.redirect_uris,
    scope: row.scope,
  };
  if (row.post_logout_redirect_uris.length > 0) {
    meta.post_logout_redirect_uris = row.post_logout_redirect_uris;
  }
  return meta;
}
