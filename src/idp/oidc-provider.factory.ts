import type { Express } from 'express';
import type { Configuration } from 'oidc-provider';
import { idpConfig } from './config/idp.config';
import { findAccount } from './users/user.store';
import { loadOrGenerateJwks, loadOrGenerateCookieKeys } from './keys/jwks';
import { SqliteAdapter } from './storage/sqlite-adapter';
import { db } from './storage/db';
import { logoutPage } from './interactions/templates';
import { resolvePersona, resolveTheme } from './interactions/personas';

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
    // Whitelist the `persona` query param so it survives across
    // /authorize and /session/end and is reachable as
    // `ctx.oidc.params.persona` / `details.params.persona`.
    extraParams: ['persona'],
    features: {
      devInteractions: { enabled: false },
      revocation: { enabled: true },
      introspection: { enabled: true },
      rpInitiatedLogout: {
        enabled: true,
        async logoutSource(ctx: any, form: string) {
          const clientId = ctx.oidc.client?.clientId as string | undefined;
          const registeredClientName: string =
            ctx.oidc.client?.clientName || clientId || 'this app';
          // oidc-provider's `extraParams` config doesn't extend to the
          // /session/end endpoint, so `ctx.oidc.params.persona` is
          // undefined here. The raw query string still carries it
          // though — read it straight off the request.
          const personaId = ctx.query?.persona as string | undefined;
          const persona = resolvePersona(personaId);
          const clientName = persona?.name ?? registeredClientName;
          const postLogout = (ctx.oidc.params?.post_logout_redirect_uri ||
            '') as string;
          let stayUrl = '/';
          try {
            if (postLogout) stayUrl = new URL(postLogout).origin + '/';
          } catch {
            stayUrl = '/';
          }
          const theme = resolveTheme(personaId);
          ctx.type = 'html';
          ctx.body = logoutPage({ clientName, form, stayUrl, theme });
        },
      },
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
      // The default policy forces a consent prompt on every login for
      // native-type clients. We use a single `native` client to back
      // both web and native shells (so https + custom-scheme URIs can
      // coexist), and we don't want to re-prompt web users on each
      // visit. Drop just that check; the rest of the consent flow
      // still triggers when scopes/claims are missing.
      policy: (() => {
        const policy = (oidcModule as any).interactionPolicy.base();
        const consent = policy.get('consent');
        if (consent?.checks?.remove) {
          consent.checks.remove('native_client_prompt');
        }
        return policy;
      })(),
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

  // Surface server-side errors to the PM2 log. oidc-provider renders a
  // generic "oops! something went wrong" page for any internal
  // exception, which is useless for debugging without the underlying
  // cause.
  for (const event of [
    'server_error',
    'authorization.error',
    'grant.error',
    'interaction.ended',
    'pushed_authorization_request.error',
    'backchannel.error',
  ] as const) {
    providerSingleton.on(event, (ctx: any, err: unknown) => {
      const params = ctx?.oidc?.params ?? ctx?.query ?? {};
      console.error(`[idp] ${event}`, {
        url: ctx?.url,
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        err:
          err instanceof Error
            ? { name: err.name, message: err.message, stack: err.stack }
            : err,
      });
    });
  }

  expressApp.use(idpConfig.oidcMountPath, providerSingleton.callback());
}

export function getProvider(): any {
  if (!providerSingleton) {
    throw new Error('oidc-provider not yet initialized');
  }
  return providerSingleton;
}
