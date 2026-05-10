import {
  getClient,
  listClients,
  removeClient,
  upsertClient,
} from '../src/idp/clients/client.store';

type Args = Record<string, string | string[] | boolean>;

function parseArgs(args: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      i++;
      const cur = out[key];
      if (cur === undefined) out[key] = next;
      else if (Array.isArray(cur)) cur.push(next);
      else out[key] = [cur as string, next];
    }
  }
  return out;
}

function arr(v: string | string[] | boolean | undefined): string[] | undefined {
  if (v === undefined || typeof v === 'boolean') return undefined;
  return Array.isArray(v) ? v : [v];
}

function str(v: string | string[] | boolean | undefined): string | undefined {
  if (typeof v === 'string') return v;
  return undefined;
}

function usage(): never {
  console.error(`Usage:
  npm run client:add -- --id <id> --name "<display name>" \\
       --redirect-uri <url> [--redirect-uri <url> ...] \\
       [--post-logout-redirect-uri <url> ...] \\
       [--resource <resource-indicator>] \\
       [--application-type web|native] \\
       [--auth-method none|client_secret_basic|client_secret_post] \\
       [--scope "<space-separated scopes>"]
  npm run client:list
  npm run client:show -- --id <id>
  npm run client:remove -- --id <id>`);
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv.shift();
  const a = parseArgs(argv);

  if (cmd === 'add') {
    const id = str(a.id);
    const name = str(a.name);
    const redirectUris = arr(a['redirect-uri']);
    if (!id || !name || !redirectUris) usage();
    const row = upsertClient({
      client_id: id,
      client_name: name,
      redirect_uris: redirectUris,
      post_logout_redirect_uris: arr(a['post-logout-redirect-uri']),
      resource: str(a.resource) ?? null,
      application_type: (str(a['application-type']) as 'web' | 'native') ?? 'web',
      token_endpoint_auth_method:
        (str(a['auth-method']) as
          | 'none'
          | 'client_secret_basic'
          | 'client_secret_post'
          | 'client_secret_jwt'
          | 'private_key_jwt') ?? 'none',
      scope: str(a.scope) ?? 'openid profile offline_access',
    });
    console.log(`Upserted client "${row.client_id}".`);
    console.log(JSON.stringify(row, null, 2));
    return;
  }

  if (cmd === 'list') {
    const rows = listClients();
    if (rows.length === 0) {
      console.log('No clients registered.');
      return;
    }
    for (const r of rows) {
      console.log(
        `${r.client_id}\t${r.client_name}\t${r.redirect_uris.join(',')}\tresource=${r.resource ?? '-'}`,
      );
    }
    return;
  }

  if (cmd === 'show') {
    const id = str(a.id);
    if (!id) usage();
    const r = getClient(id);
    if (!r) {
      console.error(`No client with id "${id}".`);
      process.exit(1);
    }
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  if (cmd === 'remove') {
    const id = str(a.id);
    if (!id) usage();
    const ok = removeClient(id);
    console.log(ok ? `Removed client "${id}".` : `No client with id "${id}".`);
    return;
  }

  usage();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
