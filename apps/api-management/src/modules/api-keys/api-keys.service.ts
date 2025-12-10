/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiKeyScope } from '@prisma/client';
import { generateApiKey, hashApiKey } from '@repo/shared';

import { PrismaService } from '../database/prisma.service';
// import { RedisService } from '../redis/redis.service';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    // private readonly redis: RedisService,
  ) {}

  // ==========================================================================
  // CREATE
  // ==========================================================================

  /**
   * Create a new API key
   */
  async create(
    projectId: string,
    data: {
      name: string;
      description?: string;
      envId?: string;
      scope?: ApiKeyScope;
      rateLimit?: number;
      ipWhitelist?: string[];
      expiresAt?: Date;
    },
    createdBy: string,
  ) {
    // Validate project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Validate environment belongs to project if provided
    if (data.envId) {
      const environment = await this.prisma.environment.findFirst({
        where: { id: data.envId, projectId },
      });
      if (!environment) {
        throw new NotFoundException('Environment not found in this project');
      }
    }

    // Generate API key (this is the ONLY time we'll have access to the plain key)
    const plainKey = generateApiKey();
    const keyHash = hashApiKey(plainKey);

    // Check if hash already exists (extremely unlikely but safety check)
    const existingKey = await this.prisma.apiKey.findFirst({
      where: { keyHash },
    });
    if (existingKey) {
      throw new BadRequestException('Key collision detected, please try again');
    }

    const apiKey = await this.prisma.apiKey.create({
      data: {
        projectId,
        envId: data.envId,
        key: plainKey, // Store plain key (consider encrypting with AES in production)
        keyHash, // Primary validation field
        name: data.name,
        description: data.description,
        scope: data.scope || ApiKeyScope.READ_ONLY,
        rateLimit: data.rateLimit || 1000,
        ipWhitelist: data.ipWhitelist || [],
        expiresAt: data.expiresAt,
        active: true,
        usageCount: 0,
        createdBy,
      },
      include: {
        environment: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    this.logger.log(`API key created: ${apiKey.id} for project ${projectId}`);

    // Return with the actual key (only shown once)
    return {
      ...apiKey,
      key: plainKey, // Return the actual key - ONLY time this is exposed
      keyHash: undefined, // Don't expose hash
    };
  }

  // ==========================================================================
  // READ
  // ==========================================================================

  /**
   * Get all API keys for a project
   */
  async findAllByProject(projectId: string) {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { projectId },
      include: {
        environment: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Don't expose the full key or keyHash
    return apiKeys.map((apiKey) => this.sanitizeApiKey(apiKey));
  }

  /**
   * Get all API keys for an environment
   */
  async findAllByEnvironment(envId: string) {
    const apiKeys = await this.prisma.apiKey.findMany({
      where: { envId, active: true },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map((apiKey) => this.sanitizeApiKey(apiKey));
  }

  /**
   * Get a single API key by ID
   */
  async findOne(id: string, projectId?: string) {
    const where: any = { id };
    if (projectId) {
      where.projectId = projectId; // Ensure user can only access keys from their projects
    }

    const apiKey = await this.prisma.apiKey.findUnique({
      where,
      include: {
        environment: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return this.sanitizeApiKey(apiKey);
  }

  /**
   * Validate an API key and return associated data
   * This is called on EVERY API request, so must be fast
   */
  async validateApiKey(plainKey: string): Promise<{
    id: string;
    projectId: string;
    envId: string | null;
    scope: ApiKeyScope;
    rateLimit: number;
    ipWhitelist: string[];
  } | null> {
    const keyHash = hashApiKey(plainKey);

    // Check cache first
    // const cacheKey = `apikey:${keyHash}`;
    // const cached = await this.redis.get(cacheKey);
    // if (cached) {
    //   const data = JSON.parse(cached);
    //   if (data.revoked) return null;
    //   return data;
    // }

    // Query database for the key
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        projectId: true,
        envId: true,
        scope: true,
        rateLimit: true,
        ipWhitelist: true,
        lastUsedAt: true,
        usageCount: true,
      },
    });

    if (!apiKey) {
      // Cache negative result briefly to prevent DB hammering
      // await this.redis.setEx(cacheKey, 60, JSON.stringify({ revoked: true }));
      return null;
    }

    // Update usage stats asynchronously (don't await)
    // Only update if last used was more than 1 minute ago to reduce writes
    const oneMinuteAgo = new Date(Date.now() - 60000);
    if (!apiKey.lastUsedAt || apiKey.lastUsedAt < oneMinuteAgo) {
      this.prisma.apiKey
        .update({
          where: { id: apiKey.id },
          data: {
            lastUsedAt: new Date(),
            usageCount: { increment: 1 },
          },
        })
        .catch((error) => {
          this.logger.warn(`Failed to update API key usage: ${error.message}`);
        });
    }

    const result = {
      id: apiKey.id,
      projectId: apiKey.projectId,
      envId: apiKey.envId,
      scope: apiKey.scope,
      rateLimit: apiKey.rateLimit || 1000,
      ipWhitelist: apiKey.ipWhitelist || [],
    };

    // Cache for 5 minutes
    // await this.redis.setEx(cacheKey, 300, JSON.stringify(result));

    return result;
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  /**
   * Update an API key
   */
  async update(
    id: string,
    projectId: string, // Add projectId for security
    data: {
      name?: string;
      description?: string;
      scope?: ApiKeyScope;
      rateLimit?: number;
      ipWhitelist?: string[];
      expiresAt?: Date | null;
      active?: boolean;
    },
  ) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, projectId }, // Ensure key belongs to project
    });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data,
      include: {
        environment: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    // Invalidate cache
    // await this.redis.del(`apikey:${existing.keyHash}`);

    this.logger.log(`API key updated: ${id}`);

    return this.sanitizeApiKey(updated);
  }

  /**
   * Rotate an API key (generate new key, keep settings)
   */
  async rotate(id: string, projectId: string, userId: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, projectId },
    });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    const newPlainKey = generateApiKey();
    const newKeyHash = hashApiKey(newPlainKey);

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        key: newPlainKey,
        keyHash: newKeyHash,
        rotatedFrom: existing.id, // Store old key ID, not hash
        rotatedAt: new Date(),
      },
      include: {
        environment: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    // Invalidate old cache
    // await this.redis.del(`apikey:${existing.keyHash}`);

    this.logger.log(`API key rotated: ${id} by user ${userId}`);

    return {
      ...this.sanitizeApiKey(updated),
      key: newPlainKey, // Return new key (only shown once)
      message:
        '⚠️ API key rotated successfully. Save this key - it will not be shown again.',
    };
  }

  /**
   * Revoke an API key
   */
  async revoke(id: string, projectId: string, revokedBy: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, projectId },
    });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id },
      data: {
        active: false,
        revokedAt: new Date(),
        revokedBy,
      },
    });

    // Invalidate cache
    // await this.redis.del(`apikey:${existing.keyHash}`);

    this.logger.log(`API key revoked: ${id} by ${revokedBy}`);

    return { revoked: true, id };
  }

  /**
   * Delete an API key permanently
   */
  async delete(id: string, projectId: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, projectId },
    });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.delete({ where: { id } });

    // Invalidate cache
    // await this.redis.del(`apikey:${existing.keyHash}`);

    this.logger.log(`API key deleted: ${id}`);

    return { deleted: true, id };
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Check if IP is allowed for an API key
   */
  isIpAllowed(ipWhitelist: string[], clientIp: string): boolean {
    if (!ipWhitelist || ipWhitelist.length === 0) {
      return true; // No whitelist = all IPs allowed
    }

    return ipWhitelist.includes(clientIp);
  }

  /**
   * Check rate limit for an API key
   */
  // async checkRateLimit(
  //   keyHash: string,
  //   limit: number,
  //   windowSeconds: number = 60,
  // ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  //   const key = `ratelimit:${keyHash}`;
  //   const now = Date.now();
  //   const windowMs = windowSeconds * 1000;
  //   
  //   // Use Redis sorted set with timestamps
  //   await this.redis.zRemRangeByScore(key, 0, now - windowMs);
  //   const current = await this.redis.zCard(key);
  //   
  //   if (current >= limit) {
  //     const oldest = await this.redis.zRange(key, 0, 0, 'WITHSCORES');
  //     const resetAt = new Date(parseInt(oldest[1]) + windowMs);
  //     return { allowed: false, remaining: 0, resetAt };
  //   }
  //   
  //   await this.redis.zAdd(key, now, `${now}`);
  //   await this.redis.expire(key, windowSeconds);
  //   
  //   return {
  //     allowed: true,
  //     remaining: limit - current - 1,
  //     resetAt: new Date(now + windowMs),
  //   };
  // }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Sanitize API key for safe return (hide sensitive data)
   */
  private sanitizeApiKey(apiKey: any) {
    const keyPrefix = apiKey.key?.substring(0, 12) || 'ff_';
    return {
      ...apiKey,
      key: `${keyPrefix}...`, // Show only prefix
      keyHash: undefined, // Never expose hash
    };
  }
}