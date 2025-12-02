import { Injectable, type OnModuleInit, type OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, type Prisma } from '@prisma/client';

/**
 * PrismaService - Database connection manager for NestJS
 *
 * Features:
 * - Singleton pattern for connection reuse
 * - Automatic connection on module init
 * - Graceful shutdown handling
 * - Query logging in development
 * - Soft delete middleware support
 */

// Global singleton for hot-reload scenarios (development)
declare global {
  var prisma: PrismaClient | undefined;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const logLevels: Prisma.LogLevel[] =
      process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'];

    super({
      log: logLevels.map((level) => ({
        emit: 'event' as const,
        level,
      })),
      errorFormat: 'pretty',
    });

    // Use global singleton in development to prevent multiple connections
    if (process.env.NODE_ENV !== 'production') {
      if (!global.prisma) {
        global.prisma = this;
      }
    }

    // Set up query logging in development
    if (process.env.NODE_ENV === 'development') {
      this.$on('query' as never, (e: Prisma.QueryEvent) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // Error logging
    this.$on('error' as never, (e: Prisma.LogEvent) => {
      this.logger.error(`Prisma Error: ${e.message}`);
    });

    // Warning logging
    this.$on('warn' as never, (e: Prisma.LogEvent) => {
      this.logger.warn(`Prisma Warning: ${e.message}`);
    });

    // À ajouter dans le constructeur du PrismaService
    this.$use(async (params, next) => {
      if (params.model === 'User' || params.model === 'Project') {
        if (params.action === 'findUnique' || params.action === 'findFirst') {
          // 1. Intercepter la requête de lecture
          params.args.where = { ...params.args.where, deletedAt: null };
        }
        // 2. Intercepter les requêtes de suppression (DELETE)
        if (params.action === 'delete') {
          // Transformer la suppression en une simple mise à jour (UPDATE)
          params.action = 'update';
          params.args.data = { deletedAt: new Date() };
        }
        if (params.action === 'deleteMany') {
          params.action = 'updateMany';
          if (params.args.data !== undefined) {
            params.args.data.deletedAt = new Date();
          } else {
            params.args.data = { deletedAt: new Date() };
          }
        }
      }
      return next(params);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  /**
   * Clean database - USE ONLY IN TESTS
   * Deletes all data in correct order respecting foreign keys
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production!');
    }

    const tablenames = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        try {
          await this.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          this.logger.warn(`Could not truncate ${tablename}`);
        }
      }
    }
  }

  /**
   * Health check - verifies database connectivity
   */
  async healthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        latency: Date.now() - start,
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
      };
    }
  }
}
