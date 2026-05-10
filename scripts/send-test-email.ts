import 'dotenv/config';
import { getClient } from '../src/idp/clients/client.store';
import { emailService } from '../src/idp/email/email.service';

async function main() {
  const to = process.argv[2];
  const clientId = process.argv[3] ?? 'swirlock-chatbot-ui';
  if (!to) {
    console.error('Usage: npm run email:test -- <to-address> [client_id]');
    process.exit(1);
  }
  if (!emailService.isEnabled()) {
    console.error('SMTP not configured — check .env');
    process.exit(1);
  }
  const client = getClient(clientId);
  if (!client) {
    console.error(`No client registered with id "${clientId}". Use "npm run client:list".`);
    process.exit(1);
  }
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await emailService.sendVerificationCode({
    to,
    code,
    expiresAt,
    clientName: client.client_name,
  });
  console.log(
    `Sent test verification email to ${to} as "${client.client_name}" (code shown in email: ${code}).`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});
