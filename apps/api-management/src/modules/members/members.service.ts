/* eslint-disable import/order */
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { EventsService } from '../events/events.service';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto/member.dto';
import { ProjectRole, InvitationStatus, UserStatus } from '@prisma/client';
import { generateToken, addHours, isExpired, DEFAULTS } from '@repo/shared';

// =============================================================================
// Types internes alignés sur le schéma Prisma
// =============================================================================

interface UserSelect {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface UserSelectMinimal {
  id: string;
  email: string;
  name: string | null;
}

interface FormattedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly events: EventsService,
  ) {}

  // ==========================================================================
  // HELPERS - Alignés sur le schéma Prisma
  // ==========================================================================

  /**
   * Format user display name
   * Schema: User.name is a single nullable string
   */
  private formatUserName(user: { name?: string | null; email: string }): string {
    return user.name?.trim() || user.email.split('@')[0];
  }

  /**
   * Format user for API response (full version with avatar)
   */
  private formatUserResponse(user: UserSelect): FormattedUser {
    return {
      id: user.id,
      email: user.email,
      name: this.formatUserName(user),
      avatarUrl: user.avatarUrl,
    };
  }

  /**
   * Format user for API response (minimal version without avatar)
   */
  private formatUserResponseMinimal(
    user: UserSelectMinimal,
  ): Omit<FormattedUser, 'avatarUrl'> {
    return {
      id: user.id,
      email: user.email,
      name: this.formatUserName(user),
    };
  }

  // ==========================================================================
  // MEMBERS - CRUD
  // ==========================================================================

  /**
   * Get all members of a project (owner + members)
   */
  async findAllMembers(projectId: string) {
    // Get project with owner
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        status: true,
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
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

    // Get members
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Combine owner (as virtual member with OWNER role) and actual members
    const allMembers = [
      {
        id: `owner-${project.ownerId}`, // Virtual ID for owner
        projectId,
        userId: project.owner.id,
        role: ProjectRole.OWNER,
        user: this.formatUserResponse(project.owner),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        isOwner: true,
      },
      ...members.map((m) => ({
        id: m.id,
        projectId: m.projectId,
        userId: m.userId,
        role: m.role,
        user: this.formatUserResponse(m.user),
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        isOwner: false,
      })),
    ];

    return allMembers;
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    projectId: string,
    userId: string,
    dto: UpdateMemberRoleDto,
    currentUserId: string,
  ) {
    // Check project exists and not deleted
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerId: true, status: true },
    });

    if (!project || project.status === 'DELETED') {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }

    // Cannot change owner's role
    if (project.ownerId === userId) {
      throw new BadRequestException("Cannot change the owner's role");
    }

    // Cannot assign OWNER role
    if (dto.role === ProjectRole.OWNER) {
      throw new BadRequestException(
        'Cannot assign OWNER role. Transfer ownership instead.',
      );
    }

    // Find member
    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    // Update role
    const updated = await this.prisma.projectMember.update({
      where: { id: member.id },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    this.logger.log(
      `Member role updated: ${userId} in project ${projectId} from ${member.role} to ${dto.role} by ${currentUserId}`,
    );

    return {
      id: updated.id,
      projectId: updated.projectId,
      userId: updated.userId,
      role: updated.role,
      user: this.formatUserResponse(updated.user),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      isOwner: false, // ← Ajouter cette ligne
    };
  }

  /**
   * Remove a member from a project
   */
  async removeMember(projectId: string, userId: string, currentUserId: string) {
    // Check project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerId: true, status: true },
    });

    if (!project || project.status === 'DELETED') {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }

    // Cannot remove owner
    if (project.ownerId === userId) {
      throw new BadRequestException(
        'Cannot remove the project owner. Transfer ownership first.',
      );
    }

    // Find member
    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
      include: {
        user: {
          select: { email: true },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    // Delete member
    await this.prisma.projectMember.delete({
      where: { id: member.id },
    });

    // Emit event
    await this.events.emitMemberRemoved({
      projectId,
      userId,
      userEmail: member.user.email,
      removedBy: currentUserId,
    });

    this.logger.log(
      `Member removed: ${userId} from project ${projectId} by ${currentUserId}`,
    );

    return { removed: true, userId };
  }

  // ==========================================================================
  // INVITATIONS - Core Workflow
  // ==========================================================================

  /**
   * Invite a new member to a project
   *
   * WORKFLOW:
   * 1. Validate project exists and role is valid
   * 2. Check if user exists in DB
   *    - If exists: verify not already owner/member
   *    - If not exists: create in Cognito + DB
   * 3. Create Invitation record with token
   * 4. Emit event for email notification
   */
  async inviteMember(projectId: string, dto: InviteMemberDto, senderId: string) {
    // =========================================================================
    // Step 1: Validate project and role
    // =========================================================================
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        key: true,
        ownerId: true,
        status: true,
      },
    });

    if (!project || project.status === 'DELETED') {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }

    // Cannot invite as OWNER
    if (dto.role === ProjectRole.OWNER) {
      throw new BadRequestException(
        'Cannot invite as OWNER. Use ownership transfer instead.',
      );
    }

    // Get sender info for email
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, email: true, name: true },
    });

    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    // =========================================================================
    // Step 2: Check if user exists, create if needed
    // =========================================================================
    const normalizedEmail = dto.email.toLowerCase().trim();
    let targetUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, status: true },
    });

    let isNewUser = false;
    let temporaryPassword: string | undefined;

    if (targetUser) {
      // User exists - check if already owner
      if (project.ownerId === targetUser.id) {
        throw new ConflictException('This user is already the project owner');
      }

      // Check if already a member
      const existingMember = await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: targetUser.id,
          },
        },
      });

      if (existingMember) {
        throw new ConflictException(
          'This user is already a member of the project',
        );
      }
    } else {
      // =====================================================================
      // User doesn't exist - Create in Cognito + DB
      // =====================================================================
      isNewUser = true;

      try {
        // Create user in Cognito (returns cognitoId and temp password)
        const cognitoResult = await this.authService.createCognitoUser(
          normalizedEmail,
        );

        temporaryPassword = cognitoResult.temporaryPassword;

        // Create user in database with PENDING_VERIFICATION status
        targetUser = await this.prisma.user.create({
          data: {
            cognitoId: cognitoResult.cognitoId,
            email: normalizedEmail,
            status: UserStatus.PENDING_VERIFICATION,
            emailVerified: false,
          },
          select: { id: true, email: true, status: true },
        });

        this.logger.log(
          `Created new user for invitation: ${normalizedEmail} (cognitoId: ${cognitoResult.cognitoId})`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to create user for invitation: ${normalizedEmail}`,
          error,
        );
        throw new InternalServerErrorException(
          'Failed to create user account. Please try again.',
        );
      }
    }

    // =========================================================================
    // Step 3: Check for existing pending invitation
    // =========================================================================
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        projectId,
        email: normalizedEmail,
        status: InvitationStatus.PENDING,
      },
    });

    if (existingInvitation) {
      if (isExpired(existingInvitation.expiresAt)) {
        // Auto-expire old invitation
        await this.prisma.invitation.update({
          where: { id: existingInvitation.id },
          data: { status: InvitationStatus.EXPIRED },
        });
      } else {
        throw new ConflictException(
          'An invitation is already pending for this email. Cancel it first or wait for expiration.',
        );
      }
    }

    // =========================================================================
    // Step 4: Create invitation
    // =========================================================================
    const token = generateToken();
    const expiresAt = addHours(DEFAULTS.INVITATION_EXPIRY_HOURS);

    const invitation = await this.prisma.invitation.create({
      data: {
        projectId,
        email: normalizedEmail,
        role: dto.role,
        token,
        status: InvitationStatus.PENDING,
        senderId,
        expiresAt,
      },
    });

    // =========================================================================
    // Step 5: Emit event for email notification
    // =========================================================================
    await this.events.emitMemberInvited({
      projectId,
      projectName: project.name,
      invitationId: invitation.id,
      email: normalizedEmail,
      role: dto.role,
      token,
      invitedBy: senderId,
      inviterName: this.formatUserName(sender),
      inviterEmail: sender.email,
      expiresAt,
      isNewUser,
      temporaryPassword, // Only set for new users
    });

    this.logger.log(
      `Invitation sent: ${normalizedEmail} to project ${projectId} with role ${dto.role} (newUser: ${isNewUser})`,
    );

    return {
      id: invitation.id,
      projectId: invitation.projectId,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      isNewUser,
      sender: this.formatUserResponseMinimal(sender),
    };
  }

  /**
   * Get all pending invitations for a project
   */
  async getPendingInvitations(projectId: string) {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });

    if (!project || project.status === 'DELETED') {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }

    const invitations = await this.prisma.invitation.findMany({
      where: {
        projectId,
        status: InvitationStatus.PENDING,
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    return invitations.map((inv) => {
      const isExpiredNow = inv.expiresAt < now;
      return {
        id: inv.id,
        projectId: inv.projectId,
        email: inv.email,
        role: inv.role,
        status: isExpiredNow ? InvitationStatus.EXPIRED : inv.status,
        isExpired: isExpiredNow,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        sender: this.formatUserResponseMinimal(inv.sender),
      };
    });
  }

  /**
   * Accept an invitation
   *
   * WORKFLOW:
   * 1. Validate token and invitation status
   * 2. Verify accepting user's email matches invitation
   * 3. Create ProjectMember in transaction
   * 4. Update invitation status
   * 5. Activate user if pending
   */
  async acceptInvitation(token: string, userId: string) {
    // =========================================================================
    // Step 1: Find and validate invitation
    // =========================================================================
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            key: true,
            status: true,
            ownerId: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or invalid token');
    }

    // Check project is active
    if (invitation.project.status === 'DELETED') {
      throw new BadRequestException('This project no longer exists');
    }

    // Check invitation status
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Invitation has already been ${invitation.status.toLowerCase()}`,
      );
    }

    // Check expiration
    if (isExpired(invitation.expiresAt)) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException(
        'Invitation has expired. Please request a new invitation.',
      );
    }

    // =========================================================================
    // Step 2: Validate accepting user
    // =========================================================================
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify email matches
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException(
        'This invitation was sent to a different email address',
      );
    }

    // Check if user is the owner (edge case)
    if (invitation.project.ownerId === userId) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });
      return {
        accepted: true,
        alreadyMember: true,
        project: {
          id: invitation.project.id,
          name: invitation.project.name,
          key: invitation.project.key,
        },
        role: ProjectRole.OWNER,
        message: 'You are the owner of this project',
      };
    }

    // Check if already a member
    const existingMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: invitation.projectId,
          userId,
        },
      },
    });

    if (existingMember) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });
      return {
        accepted: true,
        alreadyMember: true,
        project: {
          id: invitation.project.id,
          name: invitation.project.name,
          key: invitation.project.key,
        },
        role: existingMember.role,
        message: 'You are already a member of this project',
      };
    }

    // =========================================================================
    // Step 3: Accept invitation in transaction
    // =========================================================================
    await this.prisma.executeTransaction(async (tx) => {
      // Update invitation status
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });

      // Create project member
      await tx.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userId,
          role: invitation.role,
          invitedBy: invitation.senderId,
          acceptedAt: new Date(),
        },
      });

      // Activate user if pending verification
      if (user.status === UserStatus.PENDING_VERIFICATION) {
        await tx.user.update({
          where: { id: userId },
          data: {
            status: UserStatus.ACTIVE,
            emailVerified: true,
          },
        });
      }
    });

    this.logger.log(
      `Invitation accepted: ${userId} joined project ${invitation.projectId} as ${invitation.role}`,
    );

    return {
      accepted: true,
      alreadyMember: false,
      project: {
        id: invitation.project.id,
        name: invitation.project.name,
        key: invitation.project.key,
      },
      role: invitation.role,
    };
  }

  /**
   * Cancel a pending invitation
   */
  async cancelInvitation(invitationId: string, projectId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.projectId !== projectId) {
      throw new ForbiddenException(
        'Invitation does not belong to this project',
      );
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel ${invitation.status.toLowerCase()} invitation`,
      );
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.CANCELLED },
    });

    this.logger.log(
      `Invitation cancelled: ${invitationId} for ${invitation.email}`,
    );

    return { cancelled: true, id: invitationId };
  }

  /**
   * Resend an invitation with new token and expiration
   */
  async resendInvitation(
    invitationId: string,
    projectId: string,
    senderId: string,
  ) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        project: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.projectId !== projectId) {
      throw new ForbiddenException(
        'Invitation does not belong to this project',
      );
    }

    if (invitation.project.status === 'DELETED') {
      throw new BadRequestException('Project no longer exists');
    }

    // Can only resend pending or expired invitations
    if (
      invitation.status !== InvitationStatus.PENDING &&
      invitation.status !== InvitationStatus.EXPIRED
    ) {
      throw new BadRequestException(
        `Cannot resend ${invitation.status.toLowerCase()} invitation`,
      );
    }

    // Get sender info
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, email: true, name: true },
    });

    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    // Generate new token and extend expiration
    const newToken = generateToken();
    const newExpiresAt = addHours(DEFAULTS.INVITATION_EXPIRY_HOURS);

    const updated = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        status: InvitationStatus.PENDING,
        expiresAt: newExpiresAt,
        senderId,
      },
    });

    // Check if user exists (for email template)
    const targetUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true, status: true },
    });

    const isNewUser =
      !targetUser || targetUser.status === UserStatus.PENDING_VERIFICATION;

    // Emit event for email notification
    await this.events.emitMemberInvited({
      projectId,
      projectName: invitation.project.name,
      invitationId: invitation.id,
      email: invitation.email,
      role: invitation.role,
      token: newToken,
      invitedBy: senderId,
      inviterName: this.formatUserName(sender),
      inviterEmail: sender.email,
      expiresAt: newExpiresAt,
      isNewUser,
      isResend: true,
    });

    this.logger.log(`Invitation resent: ${invitationId} to ${invitation.email}`);

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      expiresAt: updated.expiresAt,
      resent: true,
    };
  }
}