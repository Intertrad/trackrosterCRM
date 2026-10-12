import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { configureHttpApplication } from './config/http-application.js';
import { parseTrustProxy } from './config/http-security.js';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: parseTrustProxy(process.env.TRUST_PROXY) }),
  );

  await configureHttpApplication(app);
  const port = Number(app.get(ConfigService).get<string>('PORT') ?? 3001);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
