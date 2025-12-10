import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';

import { MembersController, InvitationsController } from './members.controller';
import { MembersService } from './members.service';


@Module({
  imports: [AuthModule, EventsModule],
  controllers: [MembersController, InvitationsController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
