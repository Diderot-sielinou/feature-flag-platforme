import { Injectable } from '@nestjs/common';

import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  check() {
    return {
      status: 'ok',
      service: 'api-read',
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  async ready() {
    const [dbOk, cacheOk] = await Promise.all([
      this.prisma.healthCheck(),
      this.cache.healthCheck(),
    ]);

    const checks = {
      database: dbOk ? 'healthy' : 'unhealthy',
      cache: cacheOk ? 'healthy' : 'unhealthy',
    };

    const isHealthy = dbOk && cacheOk;

    return {
      status: isHealthy ? 'ready' : 'degraded',
      checks,
      cacheStats: this.cache.getStats(),
      timestamp: new Date().toISOString(),
    };
  }
}
