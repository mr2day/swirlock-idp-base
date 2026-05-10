import 'dotenv/config';
import { emailService } from '../src/idp/email/email.service';

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: npm run email:test -- <to-address>');
    process.exit(1);
  }
  if (!emailService.isEnabled()) {
    console.error('SMTP not configured — check .env');
    process.exit(1);
  }
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await emailService.sendVerificationCode({
    to,
    code,
    expiresAt,
    clientName: 'Swirlock Chatbot UI',
  });
  console.log(`Sent test verification email to ${to} (code shown in email: ${code}).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : e);
  process.exit(1);
});
