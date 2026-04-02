import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
// eslint-disable-next-line import/order
import { AppService } from './app.service';

// Common
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
// eslint-disable-next-line import/order
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

import configuration from './config/configuration';
import { HealthModule } from './health/health.module';
import { ApiKeysModule } from './modules/api-keys';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { EnvironmentsModule } from './modules/environments/environments.module';
import { EventsModule } from './modules/events/events.module';
import { FlagsModule } from './modules/flags/flags.module';
import { MembersModule } from './modules/members/members.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RedisModule } from './modules/redis/redis.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
    HealthModule,
    DatabaseModule,

    // Core infrastructure modules
    DatabaseModule,
    RedisModule,
    AuthModule,
    EventsModule,

    // Feature modules
    HealthModule,
    ProjectsModule,
    EnvironmentsModule,
    FlagsModule,
    MembersModule,

    // New feature modules
    ApiKeysModule, // Table 5: API Keys management
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // Global response transformation
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Global request logging
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
