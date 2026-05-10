import { upsertVerifiedAccount } from '../src/idp/users/user.store';
import { getClient } from '../src/idp/clients/client.store';

async function main() {
  const [, , clientId, email, password] = process.argv;
  if (!clientId || !email || !password) {
    console.error('Usage: npm run seed -- <client_id> <email> <password>');
    process.exit(1);
  }
  const client = getClient(clientId);
  if (!client) {
    console.error(
      `No client registered with id "${clientId}". Run "npm run client:add -- ..." first.`,
    );
    process.exit(1);
  }
  const account = await upsertVerifiedAccount({ clientId, email, password });
  console.log(`Upserted verified account ${account.id} (${account.email}) for ${clientId}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
