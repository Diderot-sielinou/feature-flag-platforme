// packages/database/src/prisma.service.ts
import { Injectable, type OnModuleInit, type OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const logLevels: Prisma.LogLevel[] =
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'];

    super({
      log: logLevels.map((level) => ({
        emit: 'event' as const,
        level,
      })),
      errorFormat: 'pretty',
    });

    // Singleton pattern for development hot-reload
    if (process.env.NODE_ENV !== 'production') {
      if (!global.prisma) {
        global.prisma = this;
      }
    }

    this.setupLogging();
  }

  private setupLogging(): void {
    if (process.env.NODE_ENV === 'development') {
      this.$on('query' as never, (e: Prisma.QueryEvent) => {
        if (e.duration > 100) {
          this.logger.warn(`🐌 Slow query (${e.duration}ms): ${e.query}`);
        } else {
          this.logger.debug(`Query (${e.duration}ms): ${e.query.substring(0, 100)}...`);
        }
      });
    }

    this.$on('error' as never, (e: Prisma.LogEvent) => {
      this.logger.error(`Database error: ${e.message}`);
    });

    this.$on('warn' as never, (e: Prisma.LogEvent) => {
      this.logger.warn(`Database warning: ${e.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ Successfully connected to PostgreSQL database');
    } catch (error) {
      this.logger.error('❌ Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  /**
   * Health check for database connectivity
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency: number;
    message?: string;
  }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute a transaction with retry logic
   * Handles deadlocks and serialization failures automatically
   */
  async executeTransaction<T>(
    fn: (prisma: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxRetries?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<T> {
    const { maxRetries = 3, isolationLevel } = options || {};
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.$transaction(fn, {
          isolationLevel,
          timeout: 10000, // 10 seconds
        });
      } catch (error) {
        lastError = error as Error;
        
        // Check if retryable error (deadlock, serialization failure)
        const isRetryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2028'].includes(error.code);

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        this.logger.warn(
          `Transaction failed (attempt ${attempt}/${maxRetries}), retrying...`,
        );
        
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 100),
        );
      }
    }

    throw lastError;
  }

  /**
   * Clean database - USE ONLY IN TESTS
   * @throws Error if called in production
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('❌ Cannot clean database in production!');
    }

    const tablenames = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        try {
          await this.$executeRawUnsafe(
            `TRUNCATE TABLE "public"."${tablename}" CASCADE;`,
          );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          this.logger.warn(`Could not truncate ${tablename}`);
        }
      }
    }
    
    this.logger.log('🧹 Database cleaned successfully');
  }
}