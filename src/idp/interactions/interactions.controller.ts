import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { emailService } from '../email/email.service';
import { getProvider } from '../oidc-provider.factory';
import {
  AccountRow,
  createPendingAccount,
  getAccountById,
  markEmailVerified,
  verifyAccountPassword,
} from '../users/user.store';
import { getVerification, issueCode, verifyCode } from '../users/verifications.store';
import { consentPage, loginPage, signupPage, verifyEmailPage } from './templates';

async function clientNameFor(provider: any, clientId: string | undefined): Promise<string> {
  if (!clientId) return 'Unknown app';
  const client = await provider.Client.find(clientId);
  return client?.clientName || clientId || 'Unknown app';
}

@Controller('interaction')
export class InteractionsController {
  @Get(':uid')
  async render(@Req() req: Request, @Res() res: Response, @Param('uid') _uid: string) {
    const provider = getProvider();
    const details = await provider.interactionDetails(req, res);
    const clientId = details.params.client_id as string | undefined;
    const clientName = await clientNameFor(provider, clientId);

    if (details.prompt.name === 'login') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.send(loginPage({ uid: details.uid, clientName }));
      return;
    }

    if (details.prompt.name === 'consent') {
      const oidcScopes: string[] =
        (details.prompt.details.missingOIDCScope as string[] | undefined) ?? [];
      const resourceScopes =
        (details.prompt.details.missingResourceScopes as Record<string, string[]> | undefined) ??
        {};
      const scopes = [...oidcScopes, ...Object.values(resourceScopes).flat()];
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.send(consentPage({ uid: details.uid, clientName, scopes }));
      return;
    }

    res.status(400).send(`Unknown prompt: ${details.prompt.name}`);
  }

  @Post(':uid/login')
  async login(
    @Req() req: Request,
    @Res() res: Response,
    @Param('uid') _uid: string,
    @Body() body: { email?: string; password?: string },
  ) {
    const provider = getProvider();
    const details = await provider.interactionDetails(req, res);
    const clientId = details.params.client_id as string | undefined;
    const clientName = await clientNameFor(provider, clientId);
    const email = (body.email || '').trim();
    const password = body.password || '';

    if (!clientId) {
      res.status(400).send('Missing client_id in interaction.');
      return;
    }

    const account = await verifyAccountPassword({ clientId, email, password });
    if (!account) {
      res.status(400).setHeader('content-type', 'text/html; charset=utf-8');
      res.send(
        loginPage({ uid: details.uid, clientName, email, error: 'Invalid email or password.' }),
      );
      return;
    }

    if (!account.email_verified_at) {
      // Email never confirmed. Issue a fresh code and redirect to verify-email.
      await this.sendCodeAndRedirect(res, details.uid, account, clientName);
      return;
    }

    await provider.interactionFinished(
      req,
      res,
      { login: { accountId: account.id } },
      { mergeWithLastSubmission: false },
    );
  }

  @Get(':uid/signup')
  async renderSignup(
    @Req() req: Request,
    @Res() res: Response,
    @Param('uid') _uid: string,
  ) {
    const provider = getProvider();
    const details = await provider.interactionDetails(req, res);
    if (details.prompt.name !== 'login') {
      res.status(400).send('Signup is only available during a login prompt.');
      return;
    }
    const clientName = await clientNameFor(provider, details.params.client_id as string);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send(signupPage({ uid: details.uid, clientName }));
  }

  @Post(':uid/signup')
  async signup(
    @Req() req: Request,
    @Res() res: Response,
    @Param('uid') _uid: string,
    @Body() body: { email?: string; password?: string; confirm?: string },
  ) {
    const provider = getProvider();
    const details = await provider.interactionDetails(req, res);
    const clientId = details.params.client_id as string | undefined;
    const clientName = await clientNameFor(provider, clientId);

    if (!clientId) {
      res.status(400).send('Missing client_id in interaction.');
      return;
    }

    const email = (body.email || '').trim();
    const password = body.password || '';
    const confirm = body.confirm || '';

    const renderError = (error: string) => {
      res.status(400).setHeader('content-type', 'text/html; charset=utf-8');
      res.send(signupPage({ uid: details.uid, clientName, email, error }));
    };

    if (password !== confirm) return renderError('Passwords do not match.');

    const result = await createPendingAccount({ clientId, email, password });
    if (!result.ok) {
      const message =
        result.error === 'email_invalid'
          ? 'Please enter a valid email address.'
          : result.error === 'password_too_short'
            ? 'Password must be at least 8 characters.'
            : 'An account with this email already exists for this app. Try signing in instead.';
      return renderError(message);
    }

    await this.sendCodeAndRedirect(res, details.uid, result.account, clientName);
  }

  @Get(':uid/verify-email')
  async renderVerifyEmail(
    @Req() req: Request,
    @Res() res: Response,
    @Param('uid') _uid: string,
    @Query('vid') vid?: string,
  ) {
    const provider = getProvider();
    const details = await provider.interactionDetails(req, res);
    if (!vid) {
      res.status(400).send('Missing verification id.');
      return;
    }
    const verification = getVerification(vid);
    if (!verification) {
      res.status(400).send('Verification not found or already consumed.');
      return;
    }
    const account = getAccountById(verification.account_id);
    if (!account) {
      res.status(400).send('Account not found.');
      return;
    }
    const clientName = await clientNameFor(provider, details.params.client_id as string);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send(
      verifyEmailPage({
        uid: details.uid,
        clientName,
        email: account.email,
        verificationId: vid,
      }),
    );
  }

  @Post(':uid/verify-email')
  async verifyEmail(
    @Req() req: Request,
    @Res() res: Response,
    @Param('uid') _uid: string,
    @Body() body: { vid?: string; code?: string },
  ) {
    const provider = getProvider();
    const details = await provider.interactionDetails(req, res);
    const vid = (body.vid || '').trim();
    const code = (body.code || '').trim();

    if (!vid) {
      res.status(400).send('Missing verification id.');
      return;
    }
    const verification = getVerification(vid);
    if (!verification) {
      res.status(400).send('Verification not found or already consumed.');
      return;
    }
    const account = getAccountById(verification.account_id);
    if (!account) {
      res.status(400).send('Account not found.');
      return;
    }
    const clientName = await clientNameFor(provider, details.params.client_id as string);

    const result = await verifyCode(vid, code);
    if (!result.ok) {
      const error =
        result.reason === 'expired'
          ? 'This code has expired. Click "Resend code" for a new one.'
          : result.reason === 'too_many_attempts'
            ? 'Too many attempts. Click "Resend code" for a new code.'
            : result.reason === 'wrong_code'
              ? 'That code does not match. Try again.'
              : 'Verification not found.';
      res.status(400).setHeader('content-type', 'text/html; charset=utf-8');
      res.send(
        verifyEmailPage({
          uid: details.uid,
          clientName,
          email: account.email,
          verificationId: vid,
          error,
        }),
      );
      return;
    }

    markEmailVerified(account.id);
    await provider.interactionFinished(
      req,
      res,
      { login: { accountId: account.id } },
      { mergeWithLastSubmission: false },
    );
  }

  @Post(':uid/resend-code')
  async resendCode(
    @Req() req: Request,
    @Res() res: Response,
    @Param('uid') _uid: string,
    @Body() body: { vid?: string },
  ) {
    const provider = getProvider();
    const details = await provider.interactionDetails(req, res);
    const vid = (body.vid || '').trim();
    if (!vid) {
      res.status(400).send('Missing verification id.');
      return;
    }
    const verification = getVerification(vid);
    if (!verification) {
      res.status(400).send('Verification not found.');
      return;
    }
    const account = getAccountById(verification.account_id);
    if (!account) {
      res.status(400).send('Account not found.');
      return;
    }
    const clientName = await clientNameFor(provider, details.params.client_id as string);
    await this.sendCodeAndRedirect(res, details.uid, account, clientName);
  }

  @Post(':uid/confirm')
  async confirm(@Req() req: Request, @Res() res: Response, @Param('uid') _uid: string) {
    const provider = getProvider();
    const details = await provider.interactionDetails(req, res);
    const { prompt, params, session } = details;
    const accountId: string = session!.accountId;
    const clientId = params.client_id as string;

    let grant = details.grantId
      ? await provider.Grant.find(details.grantId)
      : new provider.Grant({ accountId, clientId });
    if (!grant) {
      grant = new provider.Grant({ accountId, clientId });
    }

    const missingOIDCScope =
      (prompt.details.missingOIDCScope as string[] | undefined) ?? [];
    if (missingOIDCScope.length) grant.addOIDCScope(missingOIDCScope.join(' '));

    const missingOIDCClaims =
      (prompt.details.missingOIDCClaims as string[] | undefined) ?? [];
    if (missingOIDCClaims.length) grant.addOIDCClaims(missingOIDCClaims);

    const missingResourceScopes =
      (prompt.details.missingResourceScopes as Record<string, string[]> | undefined) ?? {};
    for (const [indicator, scopes] of Object.entries(missingResourceScopes)) {
      grant.addResourceScope(indicator, scopes.join(' '));
    }

    const grantId = await grant.save();
    await provider.interactionFinished(
      req,
      res,
      { consent: { grantId } },
      { mergeWithLastSubmission: true },
    );
  }

  @Post(':uid/abort')
  async abort(@Req() req: Request, @Res() res: Response, @Param('uid') _uid: string) {
    const provider = getProvider();
    await provider.interactionFinished(
      req,
      res,
      { error: 'access_denied', error_description: 'End-user denied the request' },
      { mergeWithLastSubmission: false },
    );
  }

  private async sendCodeAndRedirect(
    res: Response,
    uid: string,
    account: AccountRow,
    clientName: string,
  ): Promise<void> {
    const { verificationId, code, expiresAt } = await issueCode(account.id);
    await emailService.sendVerificationCode({
      to: account.email,
      code,
      expiresAt,
      clientName,
    });
    res.redirect(303, `/interaction/${uid}/verify-email?vid=${verificationId}`);
  }
}
