import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from './worker.module.js';

async function bootstrap(): Promise<void> {
  /*
   * This is deliberately an application context,
   * not an HTTP application.
   *
   * TrackRoster's worker has:
   *
   * - dependency injection
   * - configuration
   * - lifecycle hooks
   *
   * but:
   *
   * - no HTTP server
   * - no port
   * - no controllers
   */
  const application = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'error', 'warn'],
  });

  /*
   * Enables Nest lifecycle handling for
   * SIGINT/SIGTERM.
   *
   * BullMQ shutdown hooks will later participate
   * in this same application shutdown sequence.
   */
  application.enableShutdownHooks();

  const logger = new Logger('WorkerBootstrap');

  logger.log('TrackRoster background worker initialized');
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('WorkerBootstrap');

  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);

  logger.error('Worker bootstrap failed', message);

  process.exitCode = 1;
});
