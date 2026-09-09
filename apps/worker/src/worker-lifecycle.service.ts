import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class WorkerLifecycleService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkerLifecycleService.name);

  onApplicationBootstrap(): void {
    this.logger.log('TrackRoster worker application started');
  }

  onApplicationShutdown(signal?: string): void {
    if (signal) {
      this.logger.log(`TrackRoster worker shutting down after ${signal}`);

      return;
    }

    this.logger.log('TrackRoster worker shutting down');
  }
}
