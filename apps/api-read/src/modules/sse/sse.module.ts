import { Module } from '@nestjs/common';

import { EvalModule } from '../eval/eval.module';

import { SSEController } from './sse.controller';
import { SSEService } from './sse.service';

@Module({
  imports: [EvalModule],
  controllers: [SSEController],
  providers: [SSEService],
  exports: [SSEService],
})
export class SSEModule {}
