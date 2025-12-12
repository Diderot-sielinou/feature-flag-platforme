import { Module } from '@nestjs/common';

import { EvalController } from './eval.controller';
import { EvalService } from './eval.service';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  controllers: [EvalController],
  providers: [EvalService, ApiKeyGuard],
  exports: [EvalService],
})
export class EvalModule {}
