import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

class EmailService {
  private transporter: Transporter | null = null;
  private fromAddress = '';

  constructor() {
    const host = process.env.SMTP_HOST;
    const portRaw = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.EMAIL_FROM;
    const senderName = process.env.EMAIL_SENDER_NAME || 'Swirlock Identity';

    const port = portRaw ? parseInt(portRaw, 10) : 0;
    if (host && port && user && pass && from) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.fromAddress = `${senderName} <${from}>`;
      console.log(`[swirlock-idp:email] SMTP configured for ${host}:${port}`);
    } else {
      console.warn(
        '[swirlock-idp:email] SMTP not configured (set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/EMAIL_FROM). ' +
          'Verification codes will be logged to stdout instead of emailed.',
      );
    }
  }

  isEnabled(): boolean {
    return this.transporter !== null;
  }

  async sendVerificationCode(opts: {
    to: string;
    code: string;
    expiresAt: Date;
    clientName: string;
  }): Promise<void> {
    const minutes = Math.max(1, Math.round((opts.expiresAt.getTime() - Date.now()) / 60000));

    if (!this.transporter) {
      console.log(
        `[swirlock-idp:email-disabled] verification code for ${opts.to} (${opts.clientName}): ${opts.code} (expires in ${minutes}m)`,
      );
      return;
    }

    const subject = `Confirm your email for ${opts.clientName}`;
    const text = `Your ${opts.clientName} verification code is ${opts.code}. It expires in ${minutes} minutes. If you did not request this, ignore this email.`;
    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;line-height:1.6;color:#111;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#4F46E5;color:#fff;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">Confirm your email</h1>
    </div>
    <div style="background:#ffffff;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      <p>To finish creating your <strong>${escapeHtml(opts.clientName)}</strong> account, enter this code in your browser:</p>
      <div style="text-align:center;margin:30px 0;">
        <div style="display:inline-block;background:#f3f4f6;padding:18px 36px;border-radius:8px;border:2px solid #e5e7eb;">
          <div style="font-size:30px;font-weight:700;letter-spacing:8px;color:#4F46E5;font-family:'Courier New',monospace;">
            ${escapeHtml(opts.code)}
          </div>
        </div>
      </div>
      <p style="text-align:center;color:#6b7280;font-size:14px;">This code expires in ${minutes} minutes.</p>
      <p style="margin-top:30px;font-size:14px;color:#4b5563;">If you did not request this, you can ignore this email.</p>
    </div>
    <div style="text-align:center;padding:12px;font-size:12px;color:#6b7280;">
      <p style="margin:0;">Swirlock Identity</p>
      <p style="margin:0;">This is an automated message; do not reply.</p>
    </div>
  </div>
</body></html>`;

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: opts.to,
      subject,
      text,
      html,
    });
    console.log(`[swirlock-idp:email] verification code sent to ${opts.to}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const emailService = new EmailService();
