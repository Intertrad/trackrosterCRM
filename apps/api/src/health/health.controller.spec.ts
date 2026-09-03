import { Test, TestingModule } from '@nestjs/testing';

import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('getHealth', () => {
    it('returns the API health status', () => {
      expect(controller.getHealth()).toEqual({
        status: 'ok',
      });
    });
  });
});
