import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  EditorAndAbove,
  ViewerAndAbove,
} from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

import {
  CreateFlagDto,
  UpdateFlagDto,
  UpdateFlagStateDto,
  UpdateFlagRulesDto,
  AddToWhitelistDto,
  AddToBlacklistDto,
  CopyFlagConfigDto,
  RollbackFlagDto,
  // FlagResponseDto,
  FlagWithStatesDto,
  FlagStateResponseDto,
  FlagHistoryDto,
} from './dto/flag.dto';
import { FlagsService } from './flags.service';


@ApiTags('Flags')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/flags')
export class FlagsController {
  constructor(private readonly flagsService: FlagsService) {}

  // ==========================================================================
  // CREATE
  // ==========================================================================

  @Post()
  @EditorAndAbove()
  @ApiOperation({ summary: 'Create a new feature flag' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 201,
    description: 'Flag created',
    type: FlagWithStatesDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Flag key already exists' })
  async create(
    @Param('projectId') projectId: string,
    @Body() createFlagDto: CreateFlagDto,
    @CurrentUser('id') userId: string,
  ) {
    return await this.flagsService.create(projectId, createFlagDto, userId);
  }

  // ==========================================================================
  // READ
  // ==========================================================================

  @Get()
  @ViewerAndAbove()
  @ApiOperation({ summary: 'Get all flags for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  @ApiQuery({ name: 'tags', required: false, type: String, isArray: true })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of flags',
    type: [FlagWithStatesDto],
  })
  async findAll(
    @Param('projectId') projectId: string,
    @Query('includeArchived') includeArchived?: boolean,
    @Query('tags') tags?: string | string[],
    @Query('search') search?: string,
  ) {
    const tagArray = tags
      ? Array.isArray(tags)
        ? tags
        : [tags]
      : undefined;

    return await this.flagsService.findAllByProject(projectId, {
      includeArchived,
      tags: tagArray,
      search,
    });
  }

  @Get(':flagId')
  @ViewerAndAbove()
  @ApiOperation({ summary: 'Get flag by ID' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  @ApiResponse({
    status: 200,
    description: 'Flag details',
    type: FlagWithStatesDto,
  })
  @ApiResponse({ status: 404, description: 'Flag not found' })
  async findOne(
    @Param('projectId') projectId: string,
    @Param('flagId') flagId: string,
  ) {
    return await this.flagsService.findOne(flagId, projectId);
  }

  @Get('key/:key')
  @ViewerAndAbove()
  @ApiOperation({ summary: 'Get flag by key' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'key', description: 'Flag key' })
  @ApiResponse({
    status: 200,
    description: 'Flag details',
    type: FlagWithStatesDto,
  })
  @ApiResponse({ status: 404, description: 'Flag not found' })
  async findByKey(
    @Param('projectId') projectId: string,
    @Param('key') key: string,
  ) {
    return await this.flagsService.findByKey(projectId, key);
  }

  @Get(':flagId/environments/:envId')
  @ViewerAndAbove()
  @ApiOperation({ summary: 'Get flag state for a specific environment' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  @ApiParam({ name: 'envId', description: 'Environment ID' })
  @ApiResponse({
    status: 200,
    description: 'Flag state',
    type: FlagStateResponseDto,
  })
  async getFlagState(
    @Param('flagId') flagId: string,
    @Param('envId') envId: string,
  ) {
    return await this.flagsService.getFlagState(flagId, envId);
  }

  @Get(':flagId/environments/:envId/history')
  @ViewerAndAbove()
  @ApiOperation({ summary: 'Get flag configuration history' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  @ApiParam({ name: 'envId', description: 'Environment ID' })
  @ApiResponse({
    status: 200,
    description: 'Flag history',
    type: [FlagHistoryDto],
  })
  async getHistory(
    @Param('flagId') flagId: string,
    @Param('envId') envId: string,
  ) {
    return await this.flagsService.getHistory(flagId, envId);
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  @Put(':flagId')
  @EditorAndAbove()
  @ApiOperation({ summary: 'Update flag metadata' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  @ApiResponse({
    status: 200,
    description: 'Flag updated',
    type: FlagWithStatesDto,
  })
  async update(
    @Param('flagId') flagId: string,
    @Body() updateFlagDto: UpdateFlagDto,
  ) {
    return await this.flagsService.update(flagId, updateFlagDto);
  }

  @Patch(':flagId/environments/:envId/state')
  @EditorAndAbove()
  @ApiOperation({ summary: 'Update flag state (enable/disable)' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  @ApiParam({ name: 'envId', description: 'Environment ID' })
  @ApiResponse({
    status: 200,
    description: 'Flag state updated',
    type: FlagStateResponseDto,
  })
  async updateState(
    @Param('flagId') flagId: string,
    @Param('envId') envId: string,
    @Body() dto: UpdateFlagStateDto,
    @CurrentUser('id') userId: string,
  ) {
    return await this.flagsService.updateState(flagId, envId, dto, userId);
  }

  @Put(':flagId/environments/:envId/rules')
  @EditorAndAbove()
  @ApiOperation({ summary: 'Update flag targeting rules' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  @ApiParam({ name: 'envId', description: 'Environment ID' })
  @ApiResponse({
    status: 200,
    description: 'Rules updated',
    type: FlagStateResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid rules' })
  async updateRules(
    @Param('flagId') flagId: string,
    @Param('envId') envId: string,
    @Body() dto: UpdateFlagRulesDto,
    @CurrentUser('id') userId: string,
  ) {
    return await this.flagsService.updateRules(flagId, envId, dto, userId);
  }

  @Post(':flagId/environments/:envId/whitelist')
  @EditorAndAbove()
  @ApiOperation({ summary: 'Add entities to whitelist' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  @ApiParam({ name: 'envId', description: 'Environment ID' })
  @ApiResponse({ status: 200, description: 'Entities added to whitelist' })
  async addToWhitelist(
    @Param('flagId') flagId: string,
    @Param('envId') envId: string,
    @Body() dto: AddToWhitelistDto,
    @CurrentUser('id') userId: string,
  ) {
    return await this.flagsService.addToWhitelist(flagId, envId, dto.entityIds, userId);
  }

  @Post(':flagId/environments/:envId/blacklist')
  @EditorAndAbove()
  @ApiOperation({ summary: 'Add entities to blacklist' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  @ApiParam({ name: 'envId', description: 'Environment ID' })
  @ApiResponse({ status: 200, description: 'Entities added to blacklist' })
  async addToBlacklist(
    @Param('flagId') flagId: string,
    @Param('envId') envId: string,
    @Body() dto: AddToBlacklistDto,
    @CurrentUser('id') userId: string,
  ) {
    return await this.flagsService.addToBlacklist(flagId, envId, dto.entityIds, userId);
  }

  @Post(':flagId/copy')
  @EditorAndAbove()
  @ApiOperation({ summary: 'Copy flag configuration between environments' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  @ApiResponse({
    status: 200,
    description: 'Configuration copied',
    type: FlagStateResponseDto,
  })
  async copyConfig(
    @Param('flagId') flagId: string,
    @Body() dto: CopyFlagConfigDto,
    @CurrentUser('id') userId: string,
  ) {
    return await this.flagsService.copyConfig(flagId, dto.sourceEnvId, dto.targetEnvId, userId);
  }

  @Post(':flagId/environments/:envId/rollback')
  @EditorAndAbove()
  @ApiOperation({ summary: 'Rollback flag to a previous version' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  @ApiParam({ name: 'envId', description: 'Environment ID' })
  @ApiResponse({
    status: 200,
    description: 'Rollback successful',
    type: FlagStateResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Version not found' })
  async rollback(
    @Param('flagId') flagId: string,
    @Param('envId') envId: string,
    @Body() dto: RollbackFlagDto,
    @CurrentUser('id') userId: string,
  ) {
    return await this.flagsService.rollback(flagId, envId, dto.targetVersion, userId);
  }

  // ==========================================================================
  // DELETE
  // ==========================================================================

  @Delete(':flagId')
  @EditorAndAbove()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a flag' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'flagId', description: 'Flag ID' })
  @ApiResponse({ status: 200, description: 'Flag deleted' })
  @ApiResponse({ status: 404, description: 'Flag not found' })
  async delete(
    @Param('projectId') projectId: string,
    @Param('flagId') flagId: string,
    @CurrentUser('id') userId: string,
  ) {
    return await this.flagsService.delete(flagId, projectId,userId);
  }
}
