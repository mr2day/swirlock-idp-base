import 'reflect-metadata';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { mountOidcProvider } from './idp/oidc-provider.factory';
import { idpConfig } from './idp/config/idp.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.set('trust proxy', idpConfig.behindProxy);

  const expressApp = app.getHttpAdapter().getInstance() as express.Express;
  await mountOidcProvider(expressApp);
  expressApp.use(express.json({ limit: '1mb' }));
  expressApp.use(express.urlencoded({ extended: true, limit: '1mb' }));

  await app.listen(idpConfig.port);
  console.log(`[swirlock-idp] listening on ${idpConfig.baseUrl}`);
  console.log(
    `[swirlock-idp] discovery: ${idpConfig.issuer}/.well-known/openid-configuration`,
  );
}

bootstrap();
