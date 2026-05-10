import type { Express } from 'express';
import type { Configuration } from 'oidc-provider';
import { idpConfig } from './config/idp.config';
import { findAccount } from './users/user.store';
import { loadOrGenerateJwks, loadOrGenerateCookieKeys } from './keys/jwks';
import { SqliteAdapter } from './storage/sqlite-adapter';
import { db } from './storage/db';

const importESM = new Function('m', 'return import(m)') as <T>(m: string) => Promise<T>;

let providerSingleton: any = null;

export async function mountOidcProvider(expressApp: Express): Promise<void> {
  db();
  const oidcModule = await importESM<typeof import('oidc-provider')>('oidc-provider');
  const Provider: typeof import('oidc-provider').default =
    (oidcModule as any).default ?? (oidcModule as any);

  const jwks = loadOrGenerateJwks();
  const cookieKeys = loadOrGenerateCookieKeys();

  const config: Configuration = {
    adapter: SqliteAdapter as any,
    jwks: jwks as any,
    cookies: { keys: cookieKeys },
    findAccount: findAccount as any,
    pkce: { required: () => true },
    claims: {
      openid: ['sub'],
      profile: ['email', 'email_verified'],
    },
    scopes: ['openid', 'profile', 'offline_access'],
    features: {
      devInteractions: { enabled: false },
      revocation: { enabled: true },
      introspection: { enabled: true },
      rpInitiatedLogout: { enabled: true },
      resourceIndicators: {
        defaultResource: () => idpConfig.defaultResource ?? '',
        getResourceServerInfo: async (_ctx, resourceIndicator) => {
          return {
            scope: '',
            audience: resourceIndicator,
            accessTokenFormat: 'jwt',
            accessTokenTTL: 60 * 60,
            jwt: { sign: { alg: 'RS256' } },
          };
        },
        useGrantedResource: () => true,
      },
    },
    interactions: {
      url(_ctx, interaction) {
        return `/interaction/${interaction.uid}`;
      },
    },
    ttl: {
      AccessToken: 3600,
      IdToken: 3600,
      RefreshToken: 60 * 60 * 24 * 7,
      Session: 60 * 60 * 24 * 7,
      Interaction: 600,
      Grant: 60 * 60 * 24 * 7,
    },
  };

  providerSingleton = new Provider(idpConfig.issuer, config);
  if (idpConfig.behindProxy) {
    providerSingleton.proxy = true;
  }
  expressApp.use(idpConfig.oidcMountPath, providerSingleton.callback());
}

export function getProvider(): any {
  if (!providerSingleton) {
    throw new Error('oidc-provider not yet initialized');
  }
  return providerSingleton;
}
