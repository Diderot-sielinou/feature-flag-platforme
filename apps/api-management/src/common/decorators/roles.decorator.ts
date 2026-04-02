import { SetMetadata } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator to require specific project roles
 * 
 * Usage:
 * @Roles(ProjectRole.OWNER, ProjectRole.ADMIN)
 */
export const Roles = (...roles: ProjectRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Shorthand decorators for common role combinations
 */
export const OwnerOnly = () => Roles(ProjectRole.OWNER);
export const AdminOnly = () => Roles(ProjectRole.OWNER, ProjectRole.ADMIN);
export const EditorAndAbove = () =>
  Roles(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.EDITOR);
export const ViewerAndAbove = () =>
  Roles(
    ProjectRole.OWNER,
    ProjectRole.ADMIN,
    ProjectRole.EDITOR,
    ProjectRole.VIEWER,
  );
