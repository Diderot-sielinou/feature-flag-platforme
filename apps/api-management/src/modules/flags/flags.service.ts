// src/modules/flags/flags.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { FlagStatus, SnapshotType, Prisma } from '@prisma/client';
import { RuleSet } from '@repo/shared';

import { PrismaService } from '../database/prisma.service';
import { EventsService } from '../events/events.service';

import {
  CreateFlagDto,
  UpdateFlagDto,
  UpdateFlagStateDto,
  UpdateFlagRulesDto,
} from './dto/flag.dto';
import { RulesService } from './rules.service';

// =============================================================================
// TYPES EXPORTÉS (pour éviter l'erreur "cannot be named")
// =============================================================================

export interface EnvironmentInfo {
  id: string;
  name: string;
  key: string;
  type: string;
  color?: string | null;
}

export interface FlagStateResponse {
  id: string;
  flagId: string;
  flagKey: string;
  flagName: string;
  flagStatus: FlagStatus;
  envId: string;
  environmentName: string;
  environmentKey: string;
  environmentType: string;
  defaultState: boolean;
  rules: RuleSet;
  version: number;
  enabled: boolean;
  updatedAt: Date;
}

export interface FlagEnvironmentStateResponse {
  id: string;
  flagId: string;
  envId: string;
  environment: EnvironmentInfo;
  defaultState: boolean;
  rules: RuleSet;
  version: number;
  enabled: boolean;
  updatedAt: Date;
}

export interface FlagWithStatesResponse {
  id: string;
  projectId: string;
  key: string;
  name: string;
  description: string | null;
  tags: string[];
  status: FlagStatus;
  lifecycle: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  states: FlagEnvironmentStateResponse[];
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class FlagsService {
  private readonly logger = new Logger(FlagsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly rulesService: RulesService,
  ) {}

  // ==========================================================================
  // CREATE
  // ==========================================================================

  async create(
    projectId: string,
    dto: CreateFlagDto,
    userId: string,
  ): Promise<FlagWithStatesResponse> {
    const existing = await this.prisma.flag.findUnique({
      where: { projectId_key: { projectId, key: dto.key } },
    });

    if (existing) {
      throw new ConflictException(`Flag with key '${dto.key}' already exists`);
    }

    const environments = await this.prisma.environment.findMany({
      where: { projectId, active: true },
      select: { id: true },
    });

    if (environments.length === 0) {
      throw new BadRequestException('Project must have at least one active environment');
    }

    const flag = await this.prisma.$transaction(async (tx) => {
      const newFlag = await tx.flag.create({
        data: {
          projectId,
          key: dto.key,
          name: dto.name,
          description: dto.description,
          tags: dto.tags || [],
          status: FlagStatus.ACTIVE,
          lifecycle: 'PERMANENT',
          type: 'BOOLEAN',
          temporary: false,
        },
      });

      const defaultRules = this.rulesService.getDefaultRuleSet();

      for (const env of environments) {
        await tx.flagEnvironmentState.create({
          data: {
            flagId: newFlag.id,
            envId: env.id,
            defaultState: dto.defaultState ?? false,
            rules: defaultRules as unknown as Prisma.InputJsonValue,
            version: 1,
            enabled: true,
            cacheStrategy: 'STANDARD',
            fallbackValue: false,
            lastModifiedBy: userId,
          },
        });
      }

      await tx.project.update({
        where: { id: projectId },
        data: { currentFlagCount: { increment: 1 } },
      });

      return newFlag;
    });

    this.logger.log(`Flag created: ${flag.id} (${flag.key}) in project ${projectId}`);

    for (const env of environments) {
      await this.events.emitFlagCreated({
        projectId,
        envId: env.id,
        flagId: flag.id,
        flagKey: flag.key,
      });
    }

    return await this.findOne(flag.id, projectId);
  }

  // ==========================================================================
  // READ
  // ==========================================================================

  async findAllByProject(
    projectId: string,
    options?: {
      includeArchived?: boolean;
      tags?: string[];
      search?: string;
    },
  ): Promise<FlagWithStatesResponse[]> {
    const where: Prisma.FlagWhereInput = {
      projectId,
      status: { not: FlagStatus.DELETED },
    };

    if (!options?.includeArchived) {
      where.status = { notIn: [FlagStatus.ARCHIVED, FlagStatus.DELETED] };
    }

    if (options?.tags && options.tags.length > 0) {
      where.tags = { hasSome: options.tags };
    }

    if (options?.search) {
      where.OR = [
        { key: { contains: options.search, mode: 'insensitive' } },
        { name: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const flags = await this.prisma.flag.findMany({
      where,
      include: {
        states: {
          include: {
            environment: {
              select: { id: true, name: true, key: true, type: true, color: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return flags.map((flag) => this.formatFlagResponse(flag));
  }

  async findOne(flagId: string, projectId?: string): Promise<FlagWithStatesResponse> {
    const flag = await this.prisma.flag.findUnique({
      where: { id: flagId },
      include: {
        states: {
          include: {
            environment: {
              select: { id: true, name: true, key: true, type: true, color: true },
            },
          },
          orderBy: { environment: { sortOrder: 'asc' } },
        },
      },
    });

    if (!flag) {
      throw new NotFoundException(`Flag not found: ${flagId}`);
    }

    if (flag.status === FlagStatus.DELETED) {
      throw new NotFoundException(`Flag has been deleted: ${flagId}`);
    }

    if (projectId && flag.projectId !== projectId) {
      throw new NotFoundException(`Flag not found in project: ${projectId}`);
    }

    return this.formatFlagResponse(flag);
  }

  async findByKey(projectId: string, key: string): Promise<FlagWithStatesResponse> {
    const flag = await this.prisma.flag.findUnique({
      where: { projectId_key: { projectId, key } },
    });

    if (!flag) {
      throw new NotFoundException(`Flag not found: ${key}`);
    }

    return await this.findOne(flag.id, projectId);
  }

  async getFlagState(flagId: string, envId: string): Promise<FlagStateResponse> {
    const state = await this.prisma.flagEnvironmentState.findUnique({
      where: { flagId_envId: { flagId, envId } },
      include: {
        flag: { select: { key: true, name: true, projectId: true, status: true } },
        environment: { select: { name: true, key: true, type: true } },
      },
    });

    if (!state) {
      throw new NotFoundException(`Flag state not found for flag ${flagId} in environment ${envId}`);
    }

    return {
      id: state.id,
      flagId: state.flagId,
      flagKey: state.flag.key,
      flagName: state.flag.name,
      flagStatus: state.flag.status,
      envId: state.envId,
      environmentName: state.environment.name,
      environmentKey: state.environment.key,
      environmentType: state.environment.type,
      defaultState: state.defaultState,
      rules: state.rules as unknown as RuleSet,
      version: state.version,
      enabled: state.enabled,
      updatedAt: state.updatedAt,
    };
  }

  async getHistory(flagId: string, envId: string) {
    const state = await this.prisma.flagEnvironmentState.findUnique({
      where: { flagId_envId: { flagId, envId } },
    });

    if (!state) {
      throw new NotFoundException(`Flag state not found`);
    }

    const snapshots = await this.prisma.flagStateSnapshot.findMany({
      where: { stateId: state.id },
      orderBy: { version: 'desc' },
      take: 50,
    });

    return snapshots.map((snapshot) => ({
      id: snapshot.id,
      version: snapshot.version,
      defaultState: snapshot.defaultState,
      rules: snapshot.rules as unknown as RuleSet,
      snapshotType: snapshot.snapshotType,
      changedBy: snapshot.createdBy,
      changeReason: snapshot.reason,
      label: snapshot.label,
      createdAt: snapshot.createdAt,
    }));
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  async update(
    flagId: string,
    dto: UpdateFlagDto,
    // userId: string,
  ): Promise<FlagWithStatesResponse> {
    const existing = await this.prisma.flag.findUnique({
      where: { id: flagId },
    });

    if (!existing) {
      throw new NotFoundException(`Flag not found: ${flagId}`);
    }

    if (existing.status === FlagStatus.DELETED) {
      throw new BadRequestException('Cannot update deleted flag');
    }

    if (dto.key && dto.key !== existing.key) {
      const keyConflict = await this.prisma.flag.findUnique({
        where: { projectId_key: { projectId: existing.projectId, key: dto.key } },
      });

      if (keyConflict) {
        throw new ConflictException(`Flag with key '${dto.key}' already exists`);
      }
    }

    let status = existing.status;
    if (dto.archived !== undefined) {
      status = dto.archived ? FlagStatus.ARCHIVED : FlagStatus.ACTIVE;
    }

    const updated = await this.prisma.flag.update({
      where: { id: flagId },
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        tags: dto.tags,
        status,
      },
    });

    this.logger.log(`Flag metadata updated: ${flagId}`);

    return await this.findOne(updated.id);
  }

  async updateState(
    flagId: string,
    envId: string,
    dto: UpdateFlagStateDto,
    userId: string,
  ): Promise<FlagStateResponse> {
    const state = await this.prisma.flagEnvironmentState.findUnique({
      where: { flagId_envId: { flagId, envId } },
      include: {
        flag: { select: { key: true, projectId: true, status: true } },
      },
    });

    if (!state) {
      throw new NotFoundException(`Flag state not found`);
    }

    if (state.flag.status === FlagStatus.DELETED) {
      throw new BadRequestException('Cannot update deleted flag');
    }

    await this.saveSnapshot(
      state.id,
      state.version,
      state.defaultState,
      state.rules as unknown as RuleSet,
      userId,
      SnapshotType.AUTO,
      'State change',
    );

    const updated = await this.prisma.flagEnvironmentState.update({
      where: { id: state.id },
      data: {
        defaultState: dto.defaultState,
        version: { increment: 1 },
        lastModifiedBy: userId,
      },
    });

    await this.events.emitFlagStateChanged({
      projectId: state.flag.projectId,
      envId,
      flagId,
      flagKey: state.flag.key,
      version: updated.version,
    });

    this.logger.log(`Flag state updated: ${flagId} env=${envId} defaultState=${dto.defaultState}`);

    return await this.getFlagState(flagId, envId);
  }

  async updateRules(
    flagId: string,
    envId: string,
    dto: UpdateFlagRulesDto,
    userId: string,
  ): Promise<FlagStateResponse> {
    const validation = this.rulesService.validateRules(dto.rules as RuleSet);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Invalid rules',
        errors: validation.errors,
      });
    }

    const state = await this.prisma.flagEnvironmentState.findUnique({
      where: { flagId_envId: { flagId, envId } },
      include: {
        flag: { select: { key: true, projectId: true, status: true } },
      },
    });

    if (!state) {
      throw new NotFoundException(`Flag state not found`);
    }

    if (state.flag.status === FlagStatus.DELETED) {
      throw new BadRequestException('Cannot update deleted flag');
    }

    await this.saveSnapshot(
      state.id,
      state.version,
      state.defaultState,
      state.rules as unknown as RuleSet,
      userId,
      SnapshotType.AUTO,
      'Rules updated',
    );

    const updated = await this.prisma.flagEnvironmentState.update({
      where: { id: state.id },
      data: {
        rules: dto.rules as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
        lastModifiedBy: userId,
      },
    });

    await this.events.emitFlagUpdated({
      projectId: state.flag.projectId,
      envId,
      flagId,
      flagKey: state.flag.key,
      version: updated.version,
    });

    this.logger.log(`Flag rules updated: ${flagId} env=${envId} version=${updated.version}`);

    return await this.getFlagState(flagId, envId);
  }

  async addToWhitelist(
    flagId: string,
    envId: string,
    entityIds: string[],
    userId: string,
  ) {
    const state = await this.prisma.flagEnvironmentState.findUnique({
      where: { flagId_envId: { flagId, envId } },
      include: { flag: { select: { key: true, projectId: true } } },
    });

    if (!state) {
      throw new NotFoundException(`Flag state not found`);
    }

    await this.saveSnapshot(
      state.id,
      state.version,
      state.defaultState,
      state.rules as unknown as RuleSet,
      userId,
      SnapshotType.AUTO,
      `Added ${entityIds.length} entities to whitelist`,
    );

    const currentRules = state.rules as unknown as RuleSet;
    const newRules = this.rulesService.addToWhitelist(currentRules, entityIds);

    const updated = await this.prisma.flagEnvironmentState.update({
      where: { id: state.id },
      data: {
        rules: newRules as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
        lastModifiedBy: userId,
      },
    });

    await this.events.emitFlagUpdated({
      projectId: state.flag.projectId,
      envId,
      flagId,
      flagKey: state.flag.key,
      version: updated.version,
    });

    return { added: entityIds.length, version: updated.version };
  }

  async addToBlacklist(
    flagId: string,
    envId: string,
    entityIds: string[],
    userId: string,
  ) {
    const state = await this.prisma.flagEnvironmentState.findUnique({
      where: { flagId_envId: { flagId, envId } },
      include: { flag: { select: { key: true, projectId: true } } },
    });

    if (!state) {
      throw new NotFoundException(`Flag state not found`);
    }

    await this.saveSnapshot(
      state.id,
      state.version,
      state.defaultState,
      state.rules as unknown as RuleSet,
      userId,
      SnapshotType.AUTO,
      `Added ${entityIds.length} entities to blacklist`,
    );

    const currentRules = state.rules as unknown as RuleSet;
    const newRules = this.rulesService.addToBlacklist(currentRules, entityIds);

    const updated = await this.prisma.flagEnvironmentState.update({
      where: { id: state.id },
      data: {
        rules: newRules as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
        lastModifiedBy: userId,
      },
    });

    await this.events.emitFlagUpdated({
      projectId: state.flag.projectId,
      envId,
      flagId,
      flagKey: state.flag.key,
      version: updated.version,
    });

    return { added: entityIds.length, version: updated.version };
  }

  async copyConfig(
    flagId: string,
    sourceEnvId: string,
    targetEnvId: string,
    userId: string,
  ): Promise<FlagStateResponse> {
    const sourceState = await this.prisma.flagEnvironmentState.findUnique({
      where: { flagId_envId: { flagId, envId: sourceEnvId } },
      include: { flag: { select: { key: true, projectId: true } } },
    });

    if (!sourceState) {
      throw new NotFoundException(`Source flag state not found`);
    }

    const targetState = await this.prisma.flagEnvironmentState.findUnique({
      where: { flagId_envId: { flagId, envId: targetEnvId } },
    });

    if (!targetState) {
      throw new NotFoundException(`Target flag state not found`);
    }

    await this.saveSnapshot(
      targetState.id,
      targetState.version,
      targetState.defaultState,
      targetState.rules as unknown as RuleSet,
      userId,
      SnapshotType.MANUAL,
      `Copied from environment ${sourceEnvId}`,
    );

    // ✅ Cast explicite pour éviter l'erreur JsonValue
    const updated = await this.prisma.flagEnvironmentState.update({
      where: { id: targetState.id },
      data: {
        defaultState: sourceState.defaultState,
        rules: sourceState.rules as Prisma.InputJsonValue,
        version: { increment: 1 },
        lastModifiedBy: userId,
      },
    });

    await this.events.emitFlagUpdated({
      projectId: sourceState.flag.projectId,
      envId: targetEnvId,
      flagId,
      flagKey: sourceState.flag.key,
      version: updated.version,
    });

    this.logger.log(`Flag config copied: ${flagId} from ${sourceEnvId} to ${targetEnvId}`);

    return await this.getFlagState(flagId, targetEnvId);
  }

  async rollback(
    flagId: string,
    envId: string,
    targetVersion: number,
    userId: string,
  ): Promise<FlagStateResponse> {
    const state = await this.prisma.flagEnvironmentState.findUnique({
      where: { flagId_envId: { flagId, envId } },
      include: { flag: { select: { key: true, projectId: true } } },
    });

    if (!state) {
      throw new NotFoundException(`Flag state not found`);
    }

    const snapshot = await this.prisma.flagStateSnapshot.findFirst({
      where: { stateId: state.id, version: targetVersion },
    });

    if (!snapshot) {
      throw new NotFoundException(`Version ${targetVersion} not found in history`);
    }

    await this.saveSnapshot(
      state.id,
      state.version,
      state.defaultState,
      state.rules as unknown as RuleSet,
      userId,
      SnapshotType.MANUAL,
      `Rollback to version ${targetVersion}`,
    );

    // ✅ Cast explicite pour éviter l'erreur JsonValue
    const updated = await this.prisma.flagEnvironmentState.update({
      where: { id: state.id },
      data: {
        defaultState: snapshot.defaultState,
        rules: snapshot.rules as Prisma.InputJsonValue,
        version: { increment: 1 },
        lastModifiedBy: userId,
      },
    });

    await this.events.emitFlagUpdated({
      projectId: state.flag.projectId,
      envId,
      flagId,
      flagKey: state.flag.key,
      version: updated.version,
    });

    this.logger.log(`Flag rolled back: ${flagId} to version ${targetVersion}`);

    return await this.getFlagState(flagId, envId);
  }

  // ==========================================================================
  // DELETE
  // ==========================================================================

  async delete(flagId: string, projectId: string, _userId: string) {
    const flag = await this.prisma.flag.findUnique({
      where: { id: flagId },
      include: { states: { select: { envId: true } } },
    });

    if (!flag) {
      throw new NotFoundException(`Flag not found: ${flagId}`);
    }

    if (flag.projectId !== projectId) {
      throw new NotFoundException(`Flag not found in project: ${projectId}`);
    }

    await this.prisma.flag.update({
      where: { id: flagId },
      data: {
        status: FlagStatus.DELETED,
        deletedAt: new Date(),
      },
    });

    await this.prisma.project.update({
      where: { id: projectId },
      data: { currentFlagCount: { decrement: 1 } },
    });

    for (const state of flag.states) {
      await this.events.emitFlagDeleted({
        projectId,
        envId: state.envId,
        flagId,
        flagKey: flag.key,
      });
    }

    this.logger.log(`Flag soft-deleted: ${flagId}`);

    return { deleted: true, id: flagId };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async saveSnapshot(
    stateId: string,
    version: number,
    defaultState: boolean,
    rules: RuleSet,
    createdBy: string,
    snapshotType: SnapshotType,
    reason?: string,
  ): Promise<void> {
    await this.prisma.flagStateSnapshot.create({
      data: {
        stateId,
        version,
        defaultState,
        rules: rules as unknown as Prisma.InputJsonValue,
        snapshotType,
        createdBy,
        reason,
      },
    });
  }

  private formatFlagResponse(flag: {
    id: string;
    projectId: string;
    key: string;
    name: string;
    description: string | null;
    tags: string[];
    status: FlagStatus;
    lifecycle: string;
    type: string;
    createdAt: Date;
    updatedAt: Date;
    states: Array<{
      id: string;
      flagId: string;
      envId: string;
      defaultState: boolean;
      rules: Prisma.JsonValue;
      version: number;
      enabled: boolean;
      updatedAt: Date;
      environment: EnvironmentInfo;
    }>;
  }): FlagWithStatesResponse {
    return {
      id: flag.id,
      projectId: flag.projectId,
      key: flag.key,
      name: flag.name,
      description: flag.description,
      tags: flag.tags,
      status: flag.status,
      lifecycle: flag.lifecycle,
      type: flag.type,
      createdAt: flag.createdAt,
      updatedAt: flag.updatedAt,
      states: flag.states.map((state) => ({
        id: state.id,
        flagId: state.flagId,
        envId: state.envId,
        environment: state.environment,
        defaultState: state.defaultState,
        rules: state.rules as unknown as RuleSet,
        version: state.version,
        enabled: state.enabled,
        updatedAt: state.updatedAt,
      })),
    };
  }
}