// Verifies the SMTP credentials in .env by performing an SMTP handshake
// (no message sent). Exits 0 on success.
import 'dotenv/config';
import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT || '0', 10);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

if (!host || !port || !user || !pass) {
  console.error('SMTP_HOST/PORT/USER/PASS missing.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

try {
  await transporter.verify();
  console.log(`[smtp-verify] OK — credentials accepted by ${host}:${port}.`);
} catch (e) {
  console.error(`[smtp-verify] FAIL — ${e?.message || e}`);
  process.exit(1);
}
