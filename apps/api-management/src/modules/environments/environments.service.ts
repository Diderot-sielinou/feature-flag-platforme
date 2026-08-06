/* eslint-disable import/order */
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
// import { RedisService } from '../redis/redis.service';
import { CreateEnvironmentDto, UpdateEnvironmentDto } from './dto/environment.dto';
import { EnvironmentType, ApiKeyScope } from '@prisma/client';
import { generateApiKey, hashApiKey } from '@repo/shared';

@Injectable()
export class EnvironmentsService {
  private readonly logger = new Logger(EnvironmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    // private readonly redis: RedisService,
  ) {}

  // ==========================================================================
  // CREATE
  // ==========================================================================

  /**
   * Create a new environment for a project with associated API key
   */
  async create(projectId: string, dto: CreateEnvironmentDto, userId: string) {
    // Check if project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, key: true },
    });

    if (!project) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }

    // Generate environment key
    const environmentKey = `${project.key}_${dto.name.toLowerCase().replace(/\s+/g, '_')}`;

    // Check if environment key already exists in project
    const existing = await this.prisma.environment.findUnique({
      where: {
        projectId_key: {
          projectId,
          key: environmentKey,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Environment '${dto.name}' already exists in this project`,
      );
    }

    // Get max sort order if not provided
    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const maxSortOrder = await this.prisma.environment.findFirst({
        where: { projectId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      sortOrder = (maxSortOrder?.sortOrder ?? -1) + 1;
    }

    // Create environment and API key in transaction
    const result = await this.prisma.executeTransaction(async (tx) => {
      // 1. Create environment
      const environment = await tx.environment.create({
        data: {
          projectId,
          name: dto.name,
          key: environmentKey, // Unique identifier
          type: dto.type || EnvironmentType.CUSTOM,
          description: dto.description,
          color: dto.color,
          sortOrder,
          active: true,
          requireApproval: dto.type === EnvironmentType.PRODUCTION,
          protected: dto.type === EnvironmentType.PRODUCTION,
        },
      });

      // 2. Generate API key for this environment
      const apiKey = generateApiKey(environmentKey);
      const apiKeyHash = hashApiKey(apiKey);

      await tx.apiKey.create({
        data: {
          projectId,
          envId: environment.id,
          key: apiKey, // Store full key (should be encrypted in production)
          keyHash: apiKeyHash,
          name: `${dto.name} API Key`,
          description: `Default API key for ${dto.name} environment`,
          scope: ApiKeyScope.READ_ONLY,
          rateLimit: 1000,
          ipWhitelist: [],
          active: true,
          createdBy: userId,
        },
      });

      return { environment, apiKey };
    });

    this.logger.log(
      `Environment created: ${result.environment.id} in project ${projectId}`,
    );

    // Return with API key (only time it's shown)
    return {
      id: result.environment.id,
      projectId: result.environment.projectId,
      name: result.environment.name,
      key: result.environment.key,
      type: result.environment.type,
      description: result.environment.description,
      color: result.environment.color,
      sortOrder: result.environment.sortOrder,
      active: result.environment.active,
      apiKey: result.apiKey, // Show only on creation
      createdAt: result.environment.createdAt,
      updatedAt: result.environment.updatedAt,
    };
  }

  // ==========================================================================
  // READ
  // ==========================================================================

  /**
   * Find all environments for a project
   */
  async findAllByProject(projectId: string) {
    const environments = await this.prisma.environment.findMany({
      where: { projectId, active: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        projectId: true,
        name: true,
        key: true,
        type: true,
        description: true,
        color: true,
        sortOrder: true,
        active: true,
        requireApproval: true,
        protected: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            flagStates: true,
          },
        },
      },
    });

    // Get enabled flag counts
    const environmentsWithStats = await Promise.all(
      environments.map(async (env) => {
        const enabledCount = await this.prisma.flagEnvironmentState.count({
          where: {
            envId: env.id,
            defaultState: true,
          },
        });

        return {
          id: env.id,
          projectId: env.projectId,
          name: env.name,
          key: env.key,
          type: env.type,
          description: env.description,
          color: env.color,
          sortOrder: env.sortOrder,
          active: env.active,
          requireApproval: env.requireApproval,
          protected: env.protected,
          flagCount: env._count.flagStates,
          enabledFlagCount: enabledCount,
          createdAt: env.createdAt,
          updatedAt: env.updatedAt,
        };
      }),
    );

    return environmentsWithStats;
  }

  /**
   * Find one environment by ID
   */
  async findOne(environmentId: string) {
    const environment = await this.prisma.environment.findUnique({
      where: { id: environmentId },
      select: {
        id: true,
        projectId: true,
        name: true,
        key: true,
        type: true,
        description: true,
        color: true,
        sortOrder: true,
        active: true,
        requireApproval: true,
        protected: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            flagStates: true,
          },
        },
      },
    });

    if (!environment) {
      throw new NotFoundException(`Environment not found: ${environmentId}`);
    }

    const enabledCount = await this.prisma.flagEnvironmentState.count({
      where: {
        envId: environmentId,
        defaultState: true,
      },
    });

    return {
      ...environment,
      flagCount: environment._count.flagStates,
      enabledFlagCount: enabledCount,
    };
  }

  /**
   * Find environment by API key hash (for authentication)
   */
  async findByApiKeyHash(apiKeyHash: string) {
    // Try cache first
    // const cached = await this.redis.get(CACHE_KEYS.ENV_BY_API_KEY(apiKeyHash));
    // if (cached) {
    //   return JSON.parse(cached);
    // }

    // Query through ApiKey table
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { 
        keyHash: apiKeyHash,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        environment: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                key: true,
              },
            },
          },
        },
      },
    });

    if (!apiKey || !apiKey.environment) {
      return null;
    }

    const result = {
      id: apiKey.environment.id,
      projectId: apiKey.environment.projectId,
      name: apiKey.environment.name,
      key: apiKey.environment.key,
      type: apiKey.environment.type,
      project: apiKey.environment.project,
    };

    // Cache for future requests (5 minutes)
    // await this.redis.setEx(
    //   CACHE_KEYS.ENV_BY_API_KEY(apiKeyHash),
    //   300,
    //   JSON.stringify(result),
    // );

    return result;
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  /**
   * Update an environment
   */
  async update(
    environmentId: string,
    dto: UpdateEnvironmentDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    userId: string,
  ) {
    const existing = await this.prisma.environment.findUnique({
      where: { id: environmentId },
      include: {
        project: {
          select: { key: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Environment not found: ${environmentId}`);
    }

    // If updating name, check for conflicts with the new key
    if (dto.name && dto.name !== existing.name) {
      const newKey = `${existing.project.key}_${dto.name.toLowerCase().replace(/\s+/g, '_')}`;
      
      const keyConflict = await this.prisma.environment.findUnique({
        where: {
          projectId_key: {
            projectId: existing.projectId,
            key: newKey,
          },
        },
      });

      if (keyConflict && keyConflict.id !== environmentId) {
        throw new ConflictException(
          `Environment '${dto.name}' already exists in this project`,
        );
      }
    }

    // Prepare update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      type: dto.type,
      description: dto.description,
      color: dto.color,
      sortOrder: dto.sortOrder,
      active: dto.active,
    };

    // Only update name and key if name is provided
    if (dto.name) {
      updateData.name = dto.name;
      updateData.key = `${existing.project.key}_${dto.name.toLowerCase().replace(/\s+/g, '_')}`;
    }

    const updated = await this.prisma.environment.update({
      where: { id: environmentId },
      data: updateData,
      select: {
        id: true,
        projectId: true,
        name: true,
        key: true,
        type: true,
        description: true,
        color: true,
        sortOrder: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Invalidate cache
    // await this.redis.del(CACHE_KEYS.ENVIRONMENT(environmentId));
    
    // Invalidate API key caches for this environment
    // const apiKeys = await this.prisma.apiKey.findMany({
    //   where: { envId: environmentId },
    //   select: { keyHash: true },
    // });
    
    // for (const apiKey of apiKeys) {
    //   await this.redis.del(CACHE_KEYS.ENV_BY_API_KEY(apiKey.keyHash));
    // }

    this.logger.log(`Environment updated: ${environmentId}`);

    return updated;
  }

  // ==========================================================================
  // DELETE
  // ==========================================================================

  /**
   * Delete an environment
   */
  async delete(environmentId: string, userId: string) {
    const environment = await this.prisma.environment.findUnique({
      where: { id: environmentId },
      include: {
        _count: {
          select: { flagStates: true },
        },
      },
    });

    if (!environment) {
      throw new NotFoundException(`Environment not found: ${environmentId}`);
    }

    // Prevent deletion of protected default environments if they have flags
    if (
      environment.protected &&
      environment._count.flagStates > 0
    ) {
      throw new BadRequestException(
        `Cannot delete protected environment '${environment.name}' with existing flags. Delete flags first or archive the environment.`,
      );
    }

    // Delete environment (cascade will handle related records)
    await this.prisma.environment.delete({
      where: { id: environmentId },
    });

    // Invalidate caches
    // await this.redis.del(CACHE_KEYS.ENVIRONMENT(environmentId));
    // await this.redis.delPattern(
    //   `ff:*:${environment.projectId}:${environmentId}:*`,
    // );

    this.logger.log(`Environment deleted: ${environmentId} by user: ${userId}`);

    return { deleted: true, id: environmentId };
  }

  // ==========================================================================
  // API KEY ROTATION (calls ApiKeysService)
  // ==========================================================================

  /**
   * Rotate API key for an environment
   * Note: This method delegates to ApiKeysService
   */
  async rotateApiKey(environmentId: string, userId: string) {
    const environment = await this.prisma.environment.findUnique({
      where: { id: environmentId },
      include: {
        project: {
          select: { key: true },
        },
      },
    });

    if (!environment) {
      throw new NotFoundException(`Environment not found: ${environmentId}`);
    }

    // Get the current default API key for this environment
    const currentApiKey = await this.prisma.apiKey.findFirst({
      where: {
        envId: environmentId,
        active: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!currentApiKey) {
      throw new NotFoundException('No active API key found for this environment');
    }

    // Generate new API key
    const newApiKey = generateApiKey(environment.key);
    const newApiKeyHash = hashApiKey(newApiKey);

    // Update API key in transaction
    await this.prisma.executeTransaction(async (tx) => {
      // Mark old key as rotated
      await tx.apiKey.update({
        where: { id: currentApiKey.id },
        data: {
          active: false,
          rotatedAt: new Date(),
        },
      });

      // Create new key
      await tx.apiKey.create({
        data: {
          projectId: environment.projectId,
          envId: environment.id,
          key: newApiKey,
          keyHash: newApiKeyHash,
          name: currentApiKey.name,
          description: currentApiKey.description,
          scope: currentApiKey.scope,
          rateLimit: currentApiKey.rateLimit,
          ipWhitelist: currentApiKey.ipWhitelist,
          active: true,
          rotatedFrom: currentApiKey.keyHash,
          createdBy: userId,
        },
      });
    });

    // Invalidate old cache
    // await this.redis.del(CACHE_KEYS.ENV_BY_API_KEY(currentApiKey.keyHash));
    // await this.redis.del(CACHE_KEYS.ENVIRONMENT(environmentId));

    this.logger.log(
      `API key rotated for environment: ${environmentId} by user: ${userId}`,
    );

    return {
      apiKey: newApiKey,
      message:
        'API key rotated successfully. Save this key securely - it will not be shown again.',
    };
  }

  /**
   * Validate API key and return environment info
   */
  async validateApiKey(apiKey: string) {
    const apiKeyHash = hashApiKey(apiKey);
    const environment = await this.findByApiKeyHash(apiKeyHash);

    if (!environment) {
      return null;
    }

    return {
      environmentId: environment.id,
      projectId: environment.projectId,
      environmentName: environment.name,
      environmentType: environment.type,
    };
  }
}