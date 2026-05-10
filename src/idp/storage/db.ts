import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { idpConfig } from '../config/idp.config';

let _db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS oidc_records (
  model TEXT NOT NULL,
  id TEXT NOT NULL,
  payload TEXT NOT NULL,
  grant_id TEXT,
  user_code TEXT,
  uid TEXT,
  consumed_at INTEGER,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (model, id)
);
CREATE INDEX IF NOT EXISTS idx_oidc_grant ON oidc_records(grant_id);
CREATE INDEX IF NOT EXISTS idx_oidc_uid ON oidc_records(uid);
CREATE INDEX IF NOT EXISTS idx_oidc_user_code ON oidc_records(user_code);
CREATE INDEX IF NOT EXISTS idx_oidc_expires ON oidc_records(expires_at);

CREATE TABLE IF NOT EXISTS clients (
  client_id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  application_type TEXT NOT NULL,
  token_endpoint_auth_method TEXT NOT NULL,
  client_secret_hash TEXT,
  grant_types TEXT NOT NULL,
  response_types TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,
  post_logout_redirect_uris TEXT,
  scope TEXT NOT NULL,
  resource TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE (client_id, email),
  FOREIGN KEY (client_id) REFERENCES clients (client_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_accounts_client_email ON accounts(client_id, email);

CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  consumed_at INTEGER,
  FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_account ON email_verifications(account_id);

CREATE TABLE IF NOT EXISTS jwks (
  kid TEXT PRIMARY KEY,
  alg TEXT NOT NULL,
  use TEXT NOT NULL,
  jwk_json TEXT NOT NULL,
  active INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cookie_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  secret TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

const DROPS_V1 = `
DROP TABLE IF EXISTS users;
`;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(idpConfig.dbPath), { recursive: true });
  _db = new Database(idpConfig.dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('foreign_keys = ON');
  _db.exec(DROPS_V1);
  _db.exec(SCHEMA);
  return _db;
}
