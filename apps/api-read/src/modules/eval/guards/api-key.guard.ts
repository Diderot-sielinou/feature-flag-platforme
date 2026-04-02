import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { hashApiKey } from '@repo/shared';
import { Request } from 'express';

import { CacheService } from '../../cache/cache.service';
import { PrismaService } from '../../database/prisma.service';

export interface EnvironmentContext {
  id: string;
  projectId: string;
  name: string;
  type: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      environment?: EnvironmentContext;
    }
  }
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const apiKeyHash = hashApiKey(apiKey);

    // Try cache first
    let environment = (await this.cache.getEnvironmentByApiKey(
      apiKeyHash,
    )) as EnvironmentContext | null;

    if (!environment) {
      // Fetch from database
      const env = await this.prisma.environment.findFirst({
        where: {
          active: true,
          apiKeys: {
            some: {
              keyHash: apiKeyHash,
              active: true,
            },
          },
        },
        select: {
          id: true,
          projectId: true,
          name: true,
          type: true,
        },
      });

      if (!env) {
        this.logger.warn(`Invalid API key attempted`);
        throw new UnauthorizedException('Invalid API key');
      }

      environment = {
        id: env.id,
        projectId: env.projectId,
        name: env.name,
        type: env.type,
      };

      // Cache for future requests
      await this.cache.cacheEnvironmentByApiKey(apiKeyHash, environment);
    }

    // Attach environment to request
    request.environment = environment;

    return true;
  }

  private extractApiKey(request: Request): string | null {
    // Check X-Api-Key header first
    const headerKey = request.headers['x-api-key'];
    if (headerKey && typeof headerKey === 'string') {
      return headerKey;
    }

    // Check Authorization header (Bearer token style)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameter (for SSE connections)
    const queryKey = request.query.apiKey;
    if (queryKey && typeof queryKey === 'string') {
      return queryKey;
    }

    return null;
  }
}
