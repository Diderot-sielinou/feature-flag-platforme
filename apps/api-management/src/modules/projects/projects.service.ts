/* eslint-disable import/order */
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
// import { RedisService } from '../redis/redis.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { AuthenticatedUser } from '../auth/auth.service';
import { ProjectRole, EnvironmentType, ApiKeyScope } from '@prisma/client';
import {
  generateSlug,
  ensureUniqueSlug,
  generateApiKey,
  hashApiKey,
  DEFAULTS,
  // CACHE_KEYS,
} from '@repo/shared';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    // private readonly redis: RedisService,
  ) {}

  // ==========================================================================
  // CREATE
  // ==========================================================================

  /**
   * Create a new project with default environments and API keys
   */
  async create(dto: CreateProjectDto, user: AuthenticatedUser) {
    // Generate key (slug) if not provided
    let key = dto.slug || generateSlug(dto.name);
    let attempts = 0;

    // Ensure unique key
    while (attempts < 5) {
      const exists = await this.prisma.project.findUnique({
        where: { key },
      });
      if (!exists) break;
      key = ensureUniqueSlug(dto.slug || dto.name);
      attempts++;
    }

    if (attempts === 5) {
      throw new ConflictException('Unable to generate unique project key');
    }

    // Create project with default environments and API keys in a transaction
    const project = await this.prisma.executeTransaction(async (tx) => {
      // 1. Create the project
      const newProject = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          key,
          ownerId: user.id,
          status: 'ACTIVE',
          billingPlan: 'FREE',
          currentFlagCount: 0,
        },
      });

      // 2. Create default environments with API keys
      for (const envConfig of DEFAULTS.PROJECT_ENVIRONMENTS) {
        // Create environment
        const environment = await tx.environment.create({
          data: {
            projectId: newProject.id,
            name: envConfig.name,
            key: `${key}_${envConfig.name}`, // Unique key per environment
            type: envConfig.type as EnvironmentType,
            color: envConfig.color,
            sortOrder: envConfig.sortOrder,
            active: true,
            requireApproval: envConfig.type === 'PRODUCTION', // Production needs approval
            protected: envConfig.type === 'PRODUCTION', // Protect production
          },
        });

        // Create API key for this environment
        const apiKey = generateApiKey(`${key}_${envConfig.name}`);
        const apiKeyHash = hashApiKey(apiKey);

        await tx.apiKey.create({
          data: {
            projectId: newProject.id,
            envId: environment.id,
            key: apiKey, // Store full key (encrypted in real prod)
            keyHash: apiKeyHash,
            name: `${envConfig.name} API Key`,
            description: `Default API key for ${envConfig.name} environment`,
            scope: ApiKeyScope.READ_ONLY,
            rateLimit: 1000,
            ipWhitelist: [],
            active: true,
            createdBy: user.id,
          },
        });
      }

      return newProject;
    });

    this.logger.log(
      `Project created: ${project.id} (${project.key}) by user ${user.id}`,
    );

    // Return project with details
    return await this.findOne(project.id, user.id);
  }

  // ==========================================================================
  // READ
  // ==========================================================================

  /**
   * Find all projects accessible by a user
   */
  async findAll(userId: string) {
    // Get projects where user is owner
    const ownedProjects = await this.prisma.project.findMany({
      where: {
        ownerId: userId,
        status: { not: 'DELETED' },
      },
      include: {
        _count: {
          select: {
            flags: true,
            environments: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Get projects where user is a member
    const memberProjects = await this.prisma.projectMember.findMany({
      where: {
        userId,
        project: {
          // ← CORRECTION: filtrer ici, pas dans include
          status: { not: 'DELETED' },
        },
      },
      include: {
        project: {
          // ← CORRECTION: pas de where dans include
          include: {
            _count: {
              select: {
                flags: true,
                environments: true,
              },
            },
          },
        },
      },
    });

    // Combine and format results
    const projects = [
      ...ownedProjects.map((p) => ({
        id: p.id,
        name: p.name,
        key: p.key,
        description: p.description,
        role: ProjectRole.OWNER,
        flagCount: p._count.flags,
        environmentCount: p._count.environments,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      ...memberProjects.map((m) => ({
        id: m.project.id,
        name: m.project.name,
        key: m.project.key,
        description: m.project.description,
        role: m.role,
        flagCount: m.project._count.flags,
        environmentCount: m.project._count.environments,
        createdAt: m.project.createdAt,
        updatedAt: m.project.updatedAt,
      })),
    ];

    // Remove duplicates (shouldn't happen, but just in case)
    const uniqueProjects = projects.filter(
      (project, index, self) =>
        index === self.findIndex((p) => p.id === project.id),
    );

    // Sort by updatedAt desc
    return uniqueProjects.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }

  /**
   * Find one project by ID
   */
  async findOne(projectId: string, userId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        environments: {
          where: { active: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            key: true,
            type: true,
            color: true,
            active: true,
            sortOrder: true,
          },
        },
        _count: {
          select: {
            flags: { where: { status: { not: 'DELETED' } } },
            members: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }

    if (project.status === 'DELETED') {
      throw new NotFoundException(`Project has been deleted: ${projectId}`);
    }

    // If userId provided, check access and get role
    let userRole: ProjectRole | null = null;
    if (userId) {
      if (project.ownerId === userId) {
        userRole = ProjectRole.OWNER;
      } else {
        const membership = await this.prisma.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId,
              userId,
            },
          },
        });
        userRole = membership?.role || null;
      }
    }

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      key: project.key,
      ownerId: project.ownerId,
      owner: {
        id: project.owner.id,
        email: project.owner.email,
        name:
          [project.owner.name].filter(Boolean).join(' ') ||
          project.owner.email.split('@')[0],
      },
      environments: project.environments,
      flagCount: project._count.flags,
      memberCount: project._count.members + 1, // +1 for owner
      userRole,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  /**
   * Find project by key (slug)
   */
  async findBySlug(slug: string, userId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { key: slug },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException(`Project not found: ${slug}`);
    }

    return await this.findOne(project.id, userId);
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

 /**
 * Update a project
 */
async update(projectId: string, dto: UpdateProjectDto, userId: string) {
  // Verify project exists
  const existing = await this.prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!existing) {
    throw new NotFoundException(`Project not found: ${projectId}`);
  }

  if (existing.status === 'DELETED') {
    throw new NotFoundException(`Project has been deleted: ${projectId}`);
  }

  // Check ownership or admin role
  if (existing.ownerId !== userId) {
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    // ✅ CORRECTION ICI
    if (!membership || membership.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only owner or admin can update project settings',
      );
    }
  }

  // If updating key (slug), check uniqueness
  if (dto.slug && dto.slug !== existing.key) {
    const keyExists = await this.prisma.project.findUnique({
      where: { key: dto.slug },
    });

    if (keyExists) {
      throw new ConflictException('A project with this key already exists');
    }
  }

  // Update project
  const updated = await this.prisma.project.update({
    where: { id: projectId },
    data: {
      name: dto.name,
      description: dto.description,
      key: dto.slug,
    },
  });

  // Invalidate cache
  // await this.redis.del(CACHE_KEYS.PROJECT(projectId));

  this.logger.log(`Project updated: ${projectId} by user ${userId}`);

  return await this.findOne(updated.id, userId);
}

  // ==========================================================================
  // DELETE
  // ==========================================================================

  /**
   * Soft delete a project (owner only)
   */
  async delete(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the project owner can delete the project',
      );
    }

    // Soft delete: update status instead of hard delete
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });

    // Invalidate cache
    // await this.redis.del(CACHE_KEYS.PROJECT(projectId));
    // await this.redis.delPattern(`ff:*:${projectId}:*`);

    this.logger.log(`Project soft-deleted: ${projectId} by user ${userId}`);

    return { deleted: true, id: projectId };
  }

  // ==========================================================================
  // ACCESS CONTROL
  // ==========================================================================

  /**
   * Check if user has access to project
   */
  async hasAccess(projectId: string, userId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, status: true },
    });

    if (!project || project.status === 'DELETED') {
      return false;
    }

    if (project.ownerId === userId) {
      return true;
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    return !!membership;
  }

  /**
   * Get user role in project
   */
  async getUserRole(
    projectId: string,
    userId: string,
  ): Promise<ProjectRole | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, status: true },
    });

    if (!project || project.status === 'DELETED') {
      return null;
    }

    if (project.ownerId === userId) {
      return ProjectRole.OWNER;
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    return membership?.role || null;
  }
}
