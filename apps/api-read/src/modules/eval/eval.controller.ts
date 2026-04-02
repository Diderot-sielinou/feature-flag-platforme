import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import express from 'express';

import { EvalService } from './eval.service';
import { ApiKeyGuard, EnvironmentContext } from './guards/api-key.guard';

// =============================================================================
// DTOs
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class EvaluationContextDto {
  @IsString()
  entityId: string;

  @IsObject()
  @IsOptional()
  attributes?: Record<string, unknown>;
}

class EvaluateSingleDto {
  @IsString()
  entityId: string;

  @IsObject()
  @IsOptional()
  attributes?: Record<string, unknown>;
}

class EvaluateBulkDto {
  @IsString()
  entityId: string;

  @IsObject()
  @IsOptional()
  attributes?: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  flags?: string[];
}

class BatchEntity {
  @IsString()
  entityId: string;

  @IsObject()
  @IsOptional()
  attributes?: Record<string, unknown>;
}

class EvaluateBatchDto {
  @IsString()
  flagKey: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchEntity)
  entities: BatchEntity[];
}

// =============================================================================
// CONTROLLER
// =============================================================================

@Controller('eval')
@UseGuards(ApiKeyGuard)
export class EvalController {
  constructor(private readonly evalService: EvalService) {}

  /**
   * Evaluate a single flag for an entity
   * GET /api/v1/eval/:flagKey?entityId=xxx&attr_country=FR
   */
  @Get(':flagKey')
  async evaluateFlagGet(
    @Param('flagKey') flagKey: string,
    @Query('entityId') entityId: string,
    @Query() query: Record<string, string>,
    @Req() req: express.Request,
  ) {
    const env = req.environment as EnvironmentContext;

    // Extract attributes from query params (attr_ prefix)
    const attributes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('attr_')) {
        const attrName = key.substring(5);
        attributes[attrName] = this.parseValue(value);
      }
    }

    const result = await this.evalService.evaluateFlag(
      env.projectId,
      env.id,
      flagKey,
      { entityId, attributes },
    );

    return {
      key: result.flagKey,
      enabled: result.enabled,
      source: result.source,
      version: result.version,
    };
  }

  /**
   * Evaluate a single flag for an entity (POST for complex attributes)
   * POST /api/v1/eval/:flagKey
   */
  @Post(':flagKey')
  @HttpCode(HttpStatus.OK)
  async evaluateFlagPost(
    @Param('flagKey') flagKey: string,
    @Body() dto: EvaluateSingleDto,
    @Req() req: express.Request,
  ) {
    const env = req.environment as EnvironmentContext;

    const result = await this.evalService.evaluateFlag(
      env.projectId,
      env.id,
      flagKey,
      { entityId: dto.entityId, attributes: dto.attributes },
    );

    return {
      key: result.flagKey,
      enabled: result.enabled,
      source: result.source,
      version: result.version,
    };
  }

  /**
   * Evaluate all flags for an entity
   * GET /api/v1/eval?entityId=xxx
   */
  @Get()
  async evaluateAllGet(
    @Query('entityId') entityId: string,
    @Query() query: Record<string, string>,
    @Req() req: express.Request,
  ) {
    const env = req.environment as EnvironmentContext;

    // Extract attributes from query params
    const attributes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('attr_')) {
        const attrName = key.substring(5);
        attributes[attrName] = this.parseValue(value);
      }
    }

    const result = await this.evalService.evaluateAllFlags(
      env.projectId,
      env.id,
      { entityId, attributes },
    );

    return result;
  }

  /**
   * Evaluate multiple flags for an entity (POST)
   * POST /api/v1/eval
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async evaluateBulk(
    @Body() dto: EvaluateBulkDto,
    @Req() req: express.Request,
  ) {
    const env = req.environment as EnvironmentContext;

    if (dto.flags && dto.flags.length > 0) {
      // Evaluate specific flags
      return await this.evalService.evaluateFlags(
        env.projectId,
        env.id,
        dto.flags,
        { entityId: dto.entityId, attributes: dto.attributes },
      );
    } else {
      // Evaluate all flags
      return await this.evalService.evaluateAllFlags(env.projectId, env.id, {
        entityId: dto.entityId,
        attributes: dto.attributes,
      });
    }
  }

  /**
   * Batch evaluate a single flag for multiple entities
   * POST /api/v1/eval/batch
   */
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async evaluateBatch(
    @Body() dto: EvaluateBatchDto,
    @Req() req: express.Request,
  ) {
    const env = req.environment as EnvironmentContext;
    const results: Record<string, { enabled: boolean; source: string }> = {};

    // Evaluate for each entity in parallel
    const evaluations = await Promise.all(
      dto.entities.map((entity) =>
        this.evalService.evaluateFlag(env.projectId, env.id, dto.flagKey, {
          entityId: entity.entityId,
          attributes: entity.attributes,
        }),
      ),
    );

    for (let i = 0; i < dto.entities.length; i++) {
      const entityId = dto.entities[i].entityId;
      const result = evaluations[i];
      results[entityId] = {
        enabled: result.enabled,
        source: result.source,
      };
    }

    return {
      flagKey: dto.flagKey,
      results,
    };
  }

  /**
   * Get all flags (raw, for SDK bootstrap)
   * GET /api/v1/eval/flags
   */
  @Get('flags/all')
  async getAllFlags(@Req() req: express.Request) {
    const env = req.environment as EnvironmentContext;

    const flags = await this.evalService.getAllFlagsRaw(env.projectId, env.id);

    return {
      environment: env.name,
      flags: flags.map((f) => ({
        key: f.flagKey,
        defaultState: f.defaultState,
        version: f.version,
      })),
    };
  }

  // Helper to parse query string values
  private parseValue(value: string): unknown {
    // Try to parse as JSON for complex types
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if not valid JSON
      return value;
    }
  }
}
