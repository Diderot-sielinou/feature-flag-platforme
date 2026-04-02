// apps/api-read/src/modules/events/events.module.ts
import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { SSEModule } from '../sse/sse.module';

import { EventsConsumer } from './events.consumer';

@Module({
  imports: [CacheModule, SSEModule],
  providers: [EventsConsumer],
  exports: [EventsConsumer],
})
export class EventsModule {}
