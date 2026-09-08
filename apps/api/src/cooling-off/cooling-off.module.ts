import { Module } from '@nestjs/common';

import { ActivityRepositoryModule } from '../activities/activity-repository.module.js';
import { CoolingOffService } from './cooling-off.service.js';

@Module({
  imports: [ActivityRepositoryModule],

  providers: [CoolingOffService],

  exports: [CoolingOffService],
})
export class CoolingOffModule {}
