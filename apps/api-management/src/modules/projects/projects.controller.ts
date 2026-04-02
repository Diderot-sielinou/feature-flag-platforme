/* eslint-disable import/order */
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
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  // ProjectResponseDto,
  ProjectWithDetailsDto,
  ProjectSummaryDto,
} from './dto/project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, AdminOnly } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.service';
import { ProjectRole } from '@prisma/client';

@ApiTags('Projects')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ==========================================================================
  // CREATE
  // ==========================================================================

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully',
    type: ProjectWithDetailsDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.projectsService.create(createProjectDto, user);
  }

  // ==========================================================================
  // READ
  // ==========================================================================

  @Get()
  @ApiOperation({ summary: 'Get all projects accessible by the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of projects',
    type: [ProjectSummaryDto],
  })
  async findAll(@CurrentUser('id') userId: string) {
    return await this.projectsService.findAll(userId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(
    ProjectRole.OWNER,
    ProjectRole.ADMIN,
    ProjectRole.EDITOR,
    ProjectRole.VIEWER,
  )
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project details',
    type: ProjectWithDetailsDto,
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return await this.projectsService.findOne(id, userId);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get project by slug' })
  @ApiParam({ name: 'slug', description: 'Project slug' })
  @ApiResponse({
    status: 200,
    description: 'Project details',
    type: ProjectWithDetailsDto,
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findBySlug(
    @Param('slug') slug: string,
    @CurrentUser('id') userId: string,
  ) {
    return await this.projectsService.findBySlug(slug, userId);
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  @Put(':id')
  @UseGuards(RolesGuard)
  @AdminOnly()
  @ApiOperation({ summary: 'Update project' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project updated',
    type: ProjectWithDetailsDto,
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser('id') userId: string,
  ) {
    return await this.projectsService.update(id, updateProjectDto, userId);
  }

  // ==========================================================================
  // DELETE
  // ==========================================================================

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(ProjectRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete project (owner only)' })
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Project deleted' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Only owner can delete' })
  async delete(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return await this.projectsService.delete(id, userId);
  }
}
