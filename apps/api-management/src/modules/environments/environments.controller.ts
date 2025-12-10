import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { EnvironmentsService } from './environments.service';
import {
  CreateEnvironmentDto,
  UpdateEnvironmentDto,
  EnvironmentResponseDto,
  EnvironmentWithApiKeyDto,
  EnvironmentWithStatsDto,
  RotateApiKeyResponseDto,
} from './dto/environment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, AdminOnly, ViewerAndAbove } from '../../common/decorators/roles.decorator';
import { ProjectRole } from '@prisma/client';

@ApiTags('Environments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/environments')
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  // ==========================================================================
  // CREATE
  // ==========================================================================

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new environment' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 201,
    description: 'Environment created (API key shown only once)',
    type: EnvironmentWithApiKeyDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Environment name already exists' })
  async create(
    @Param('projectId') projectId: string,
    @Body() createEnvironmentDto: CreateEnvironmentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.environmentsService.create(projectId, createEnvironmentDto, userId);
  }

  // ==========================================================================
  // READ
  // ==========================================================================

  @Get()
  @ViewerAndAbove()
  @ApiOperation({ summary: 'Get all environments for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'List of environments with stats',
    type: [EnvironmentWithStatsDto],
  })
  async findAll(@Param('projectId') projectId: string) {
    return this.environmentsService.findAllByProject(projectId);
  }

  @Get(':id')
  @ViewerAndAbove()
  @ApiOperation({ summary: 'Get environment by ID' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'Environment ID' })
  @ApiResponse({
    status: 200,
    description: 'Environment details',
    type: EnvironmentWithStatsDto,
  })
  @ApiResponse({ status: 404, description: 'Environment not found' })
  async findOne(@Param('id') id: string) {
    return this.environmentsService.findOne(id);
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  @Put(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update environment' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'Environment ID' })
  @ApiResponse({
    status: 200,
    description: 'Environment updated',
    type: EnvironmentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Environment not found' })
  @ApiResponse({ status: 409, description: 'Name conflict' })
  async update(
    @Param('id') id: string,
    @Body() updateEnvironmentDto: UpdateEnvironmentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.environmentsService.update(id, updateEnvironmentDto, userId);
  }

  // ==========================================================================
  // DELETE
  // ==========================================================================

  @Delete(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete environment' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'Environment ID' })
  @ApiResponse({ status: 200, description: 'Environment deleted' })
  @ApiResponse({ status: 404, description: 'Environment not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete environment with flags' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.environmentsService.delete(id, userId);
  }

  // ==========================================================================
  // API KEY ROTATION
  // ==========================================================================

  @Post(':id/rotate-key')
  @AdminOnly()
  @ApiOperation({ summary: 'Rotate API key for environment' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'id', description: 'Environment ID' })
  @ApiResponse({
    status: 200,
    description: 'New API key (shown only once)',
    type: RotateApiKeyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Environment not found' })
  async rotateApiKey(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.environmentsService.rotateApiKey(id, userId);
  }
}
