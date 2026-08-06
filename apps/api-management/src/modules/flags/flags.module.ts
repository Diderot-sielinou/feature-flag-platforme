import { Module } from '@nestjs/common';

import { EventsModule } from '../events/events.module';

import { FlagsController } from './flags.controller';
import { FlagsService } from './flags.service';
import { RulesService } from './rules.service';

@Module({
  imports: [EventsModule],
  controllers: [FlagsController],
  providers: [FlagsService, RulesService],
  exports: [FlagsService, RulesService],
})
export class FlagsModule {}
