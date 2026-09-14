import { Module } from '@nestjs/common';

import { APP_INTERCEPTOR } from '@nestjs/core';

import { IdempotencyInterceptor } from './idempotency.interceptor.js';

import { IdempotencyRepositoryModule } from './idempotency-repository.module.js';

import { IdempotencyService } from './idempotency.service.js';

@Module({
  imports: [IdempotencyRepositoryModule],

  providers: [
    IdempotencyService,

    {
      provide: APP_INTERCEPTOR,

      useClass: IdempotencyInterceptor,
    },
  ],

  exports: [IdempotencyService],
})
export class IdempotencyModule {}
