/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ProjectRole, ApiKeyScope } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  IsDateString,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import { ApiKeysService } from './api-keys.service';

// =============================================================================
// DTOs
// =============================================================================

class CreateApiKeyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  envId?: string;

  @IsOptional()
  @IsEnum(ApiKeyScope)
  scope?: ApiKeyScope;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100000)
  rateLimit?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(ApiKeyScope)
  scope?: ApiKeyScope;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100000)
  rateLimit?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// =============================================================================
// CONTROLLER
// =============================================================================

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('projects/:projectId/api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  // ===========================================================================
  // CREATE
  // ===========================================================================

  @Post()
  @Roles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @ApiOperation({ 
    summary: 'Create a new API key',
    description: 'Creates a new API key for the project. The full key is only shown once upon creation.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'API key created successfully. Save the key - it will not be shown again.' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Project or environment not found' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid input data or key collision' 
  })
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateApiKeyDto,
    @Request() req: any,
  ) {
    const apiKey = await this.apiKeysService.create(
      projectId,
      {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      req.user.id,
    );

    return {
      success: true,
      data: apiKey,
      message: '⚠️ API key created. Save this key - it will not be shown again.',
    };
  }

  // ===========================================================================
  // READ
  // ===========================================================================

  @Get()
  @Roles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.EDITOR, ProjectRole.VIEWER)
  @ApiOperation({ 
    summary: 'List all API keys for a project',
    description: 'Returns all API keys for the project. Keys are masked for security.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of API keys retrieved successfully' 
  })
  async findAll(@Param('projectId') projectId: string) {
    const apiKeys = await this.apiKeysService.findAllByProject(projectId);
    return { 
      success: true, 
      data: apiKeys,
      count: apiKeys.length
    };
  }

  @Get('environment/:envId')
  @Roles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.EDITOR, ProjectRole.VIEWER)
  @ApiOperation({ 
    summary: 'List all API keys for an environment',
    description: 'Returns all active API keys for a specific environment.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of API keys retrieved successfully' 
  })
  async findByEnvironment(@Param('envId') envId: string) {
    const apiKeys = await this.apiKeysService.findAllByEnvironment(envId);
    return { 
      success: true, 
      data: apiKeys,
      count: apiKeys.length
    };
  }

  @Get(':id')
  @Roles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.EDITOR, ProjectRole.VIEWER)
  @ApiOperation({ 
    summary: 'Get an API key by ID',
    description: 'Returns details of a specific API key. The key is masked for security.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'API key retrieved successfully' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'API key not found' 
  })
  async findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    // ✅ Passer projectId pour vérification de sécurité
    const apiKey = await this.apiKeysService.findOne(id, projectId);
    return { success: true, data: apiKey };
  }

  // ===========================================================================
  // UPDATE
  // ===========================================================================

  @Put(':id')
  @Roles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @ApiOperation({ 
    summary: 'Update an API key',
    description: 'Updates API key settings such as name, scope, rate limit, IP whitelist, etc.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'API key updated successfully' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'API key not found' 
  })
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    // ✅ Passer projectId pour vérification de sécurité
    const apiKey = await this.apiKeysService.update(
      id,
      projectId,
      {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    );
    return { 
      success: true, 
      data: apiKey,
      message: 'API key updated successfully'
    };
  }

  // ===========================================================================
  // ROTATE
  // ===========================================================================

  @Post(':id/rotate')
  @Roles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Rotate an API key',
    description: 'Generates a new key while keeping the same settings. The old key becomes invalid immediately. The new key is only shown once.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'API key rotated successfully. Save the new key - it will not be shown again.' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'API key not found' 
  })
  async rotate(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    // ✅ Passer projectId pour vérification de sécurité
    const result = await this.apiKeysService.rotate(
      id,
      projectId,
      req.user.id,
    );
    return { 
      success: true, 
      data: result,
      warning: '⚠️ The old key is now invalid. Update your applications with the new key immediately.'
    };
  }

  // ===========================================================================
  // REVOKE
  // ===========================================================================

  @Post(':id/revoke')
  @Roles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Revoke an API key',
    description: 'Deactivates an API key immediately. The key is kept in the database for audit purposes but cannot be used.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'API key revoked successfully' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'API key not found' 
  })
  async revoke(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    // ✅ Passer projectId pour vérification de sécurité
    const result = await this.apiKeysService.revoke(
      id,
      projectId,
      req.user.id,
    );
    return { 
      success: true, 
      data: result,
      message: 'API key revoked successfully. It can no longer be used.'
    };
  }

  // ===========================================================================
  // DELETE
  // ===========================================================================

  @Delete(':id')
  @Roles(ProjectRole.OWNER, ProjectRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Delete an API key permanently',
    description: 'Permanently deletes an API key from the database. This action cannot be undone and removes audit history.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'API key deleted successfully' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'API key not found' 
  })
  async delete(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    // ✅ Passer projectId pour vérification de sécurité
    const result = await this.apiKeysService.delete(id, projectId);
    return { 
      success: true, 
      data: result,
      message: 'API key permanently deleted'
    };
  }
}