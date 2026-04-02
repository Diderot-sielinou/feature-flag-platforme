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
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create NestJS application
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3000;
  const nodeEnv = configService.get<string>('nodeEnv');

  // Security middleware
  app.use(helmet());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1/management');

  // CORS configuration
  app.enableCors({
    origin: configService.get<string>('cors.origin') || '*',
    credentials: configService.get<boolean>('cors.credentials') || true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Request-Id'],
  });

  // Swagger documentation (only in development)
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('LaunchLayer Management API')
      .setDescription('Feature Flags Platform - Management API Documentation')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
        'JWT-auth',
      )
      .addTag('Health', 'Health check endpoints')
      .addTag('Projects', 'Project management endpoints')
      .addTag('Environments', 'Environment management endpoints')
      .addTag('Flags', 'Feature flag management endpoints')
      .addTag('Entities', 'Entity management endpoints')
      .addTag('Members', 'Team member management endpoints')
      .addTag('Audit', 'Audit log endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    
    logger.log(`📚 Swagger documentation available at http://localhost:${port}/api/docs`);
  }

  // Start server (bind to 0.0.0.0 for Docker)
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Management API running on port ${port}`);
  logger.log(`🏥 Health check: http://localhost:${port}/api/v1/management/health`);
  logger.log(`📝 Environment: ${nodeEnv}`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start application:', err);
  process.exit(1);
});
