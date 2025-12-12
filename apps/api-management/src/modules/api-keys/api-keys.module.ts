/* eslint-disable import/order */
import { Module } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { DatabaseModule } from '../database/database.module';
// import { RedisModule } from '../redis/redis.module';
// import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DatabaseModule],
  providers: [ApiKeysService],
  controllers: [ApiKeysController],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
