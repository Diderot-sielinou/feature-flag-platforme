if (!process.env.DATABASE_URL && process.env.DB_HOST) {
  const user = encodeURIComponent(process.env.DB_USERNAME || 'postgres');
  const pass = encodeURIComponent(process.env.DB_PASSWORD || '');
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const db = process.env.DB_NAME || 'featureflags';
  process.env.DATABASE_URL = `postgresql://${user}:${pass}@${host}:${port}/${db}?schema=public`;
}

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create NestJS application with minimal logging for performance
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3001;
  const nodeEnv = configService.get<string>('nodeEnv');

  // Security middleware (minimal for performance)
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable for API
    }),
  );

  // Validation pipe with transform for query params
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS - Allow all origins for SDK access
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Api-Key', 'X-Request-Id'],
    maxAge: 86400, // Cache preflight for 24 hours
  });

  // Start server
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Read API running on port ${port}`);
  logger.log(`📊 Eval endpoint: http://localhost:${port}/api/v1/eval`);
  logger.log(`🔄 SSE endpoint: http://localhost:${port}/api/v1/sse/subscribe`);
  logger.log(`📝 Environment: ${nodeEnv}`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start Read API:', err);
  process.exit(1);
});
