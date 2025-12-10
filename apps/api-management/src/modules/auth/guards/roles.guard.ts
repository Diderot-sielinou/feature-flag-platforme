import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectRole } from '@prisma/client';

import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../auth.service';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get project ID from request params or body
    const projectId =
      request.params.projectId || request.params.id || request.body?.projectId;

    if (!projectId) {
      throw new ForbiddenException('Project ID is required');
    }

    // Check if user is the project owner
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (!project) {
      throw new ForbiddenException('Project not found');
    }

    // Owner always has full access
    if (project.ownerId === user.id) {
      // Attach role to request for later use
      request.userRole = ProjectRole.OWNER;
      return true;
    }

    // Check project membership
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      this.logger.warn(
        `User ${user.id} is not a member of project ${projectId}`,
      );
      throw new ForbiddenException('You are not a member of this project');
    }

    // Check if user has one of the required roles
    const hasRequiredRole = requiredRoles.includes(membership.role);

    if (!hasRequiredRole) {
      this.logger.warn(
        `User ${user.id} with role ${membership.role} does not have required roles: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException(
        `This action requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }

    // Attach role to request for later use
    request.userRole = membership.role;
    request.projectId = projectId;
    return true;
  }
}
