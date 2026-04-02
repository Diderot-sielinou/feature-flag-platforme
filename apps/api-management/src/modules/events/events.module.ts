// src/modules/events/events.module.ts

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EmailModule } from '../email/email.module';

import { EventsService } from './events.service';


@Global()
@Module({
  imports: [ConfigModule, EmailModule],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}