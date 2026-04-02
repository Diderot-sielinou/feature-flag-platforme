/* eslint-disable import/order */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Core modules
import { DatabaseModule } from './modules/database/database.module';
import { CacheModule } from './modules/cache/cache.module';
import { EventsModule } from './modules/events/events.module';

// Feature modules
import { HealthModule } from './modules/health/health.module';
import { EvalModule } from './modules/eval/eval.module';
import { SSEModule } from './modules/sse/sse.module';

// Configuration
import configuration from './config/configuration';

@Module({
  imports: [
    // Configuration globale
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Infrastructure core
    DatabaseModule, // Prisma (fallback si cache miss)
    CacheModule, // Redis 2-tier cache

    // Events consumer (SQS en prod, Redis en dev)
    EventsModule,

    // Feature modules
    HealthModule, // Health checks
    EvalModule, // Flag evaluation
    SSEModule, // Server-Sent Events
  ],
})
export class AppModule {}
