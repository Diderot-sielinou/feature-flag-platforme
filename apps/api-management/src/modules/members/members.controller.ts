/* eslint-disable import/order */
// =============================================================================
// members/members.controller.ts
// =============================================================================

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
  ApiBody,
} from '@nestjs/swagger';
// import { ProjectRole } from '@prisma/client';

import { MembersService } from './members.service';
import {
  InviteMemberDto,
  UpdateMemberRoleDto,
  AcceptInvitationDto,
  MemberResponseDto,
  RemoveMemberResponseDto,
  InvitationResponseDto,
  CancelInvitationResponseDto,
  ResendInvitationResponseDto,
  AcceptInvitationResponseDto,
} from './dto/member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AdminOnly,
  ViewerAndAbove,
} from '../../common/decorators/roles.decorator';

// =============================================================================
// MEMBERS CONTROLLER - Scoped to Project
// =============================================================================

@ApiTags('Members')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  // ===========================================================================
  // MEMBERS - CRUD
  // ===========================================================================

  /**
   * Get all members of a project (including owner)
   */
  @Get()
  @ViewerAndAbove()
  @ApiOperation({
    summary: 'Get all members of a project',
    description:
      'Returns all members including the owner. Owner is returned as a virtual member with OWNER role.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of project members',
    type: [MemberResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async findAllMembers(
    @Param('projectId') projectId: string,
  ): Promise<MemberResponseDto[]> {
    return await this.membersService.findAllMembers(projectId);
  }

  /**
   * Update a member's role
   */
  @Put(':userId/role')
  @AdminOnly()
  @ApiOperation({
    summary: "Update a member's role",
    description:
      'Change the role of a project member. Cannot change owner role or assign OWNER role.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String })
  @ApiParam({
    name: 'userId',
    description: 'User ID of the member to update',
    type: String,
  })
  @ApiBody({ type: UpdateMemberRoleDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Role updated successfully',
    type: MemberResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot change owner role or assign OWNER role',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project or member not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions (Admin+ required)',
  })
  async updateMemberRole(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser('id') currentUserId: string,
  ): Promise<MemberResponseDto> {
    return await this.membersService.updateMemberRole(
      projectId,
      userId,
      dto,
      currentUserId,
    );
  }

  /**
   * Remove a member from the project
   */
  @Delete(':userId')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove a member from the project',
    description:
      'Removes a member from the project. Cannot remove the owner. Members can remove themselves.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String })
  @ApiParam({
    name: 'userId',
    description: 'User ID of the member to remove',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Member removed successfully',
    type: RemoveMemberResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot remove project owner',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project or member not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions (Admin+ required)',
  })
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @CurrentUser('id') currentUserId: string,
  ): Promise<RemoveMemberResponseDto> {
    return await this.membersService.removeMember(projectId, userId, currentUserId);
  }

  // ===========================================================================
  // INVITATIONS - Management
  // ===========================================================================

  /**
   * Invite a new member to the project
   */
  @Post('invite')
  @AdminOnly()
  @ApiOperation({
    summary: 'Invite a new member to the project',
    description: `
      Sends an invitation to join the project. 
      - If the user doesn't exist, creates a placeholder account in DB
      - Generates invitation token (72h expiry)
      - Triggers email notification via EventBridge
    `,
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String })
  @ApiBody({ type: InviteMemberDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Invitation sent successfully',
    type: InvitationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot invite as OWNER',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already a member or pending invitation exists',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions (Admin+ required)',
  })
  async inviteMember(
    @Param('projectId') projectId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser('id') senderId: string,
  ): Promise<InvitationResponseDto> {
    return await this.membersService.inviteMember(projectId, dto, senderId);
  }

  /**
   * Get all pending invitations for the project
   */
  @Get('invitations')
  @AdminOnly()
  @ApiOperation({
    summary: 'Get pending invitations',
    description:
      'Returns all pending invitations. Expired invitations are marked as such in the response.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of pending invitations',
    type: [InvitationResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Project not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions (Admin+ required)',
  })
  async getPendingInvitations(
    @Param('projectId') projectId: string,
  ): Promise<InvitationResponseDto[]> {
    return await this.membersService.getPendingInvitations(projectId);
  }

  /**
   * Cancel a pending invitation
   */
  @Delete('invitations/:invitationId')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an invitation',
    description: 'Cancels a pending invitation. Cannot cancel non-pending invitations.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String })
  @ApiParam({
    name: 'invitationId',
    description: 'Invitation ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation cancelled successfully',
    type: CancelInvitationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot cancel non-pending invitation',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Invitation does not belong to this project',
  })
  async cancelInvitation(
    @Param('projectId') projectId: string,
    @Param('invitationId') invitationId: string,
  ): Promise<CancelInvitationResponseDto> {
    return await this.membersService.cancelInvitation(invitationId, projectId);
  }

  /**
   * Resend an invitation
   */
  @Post('invitations/:invitationId/resend')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend an invitation',
    description:
      'Resends an invitation with a new token and extended expiration. Works for pending or expired invitations.',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID', type: String })
  @ApiParam({
    name: 'invitationId',
    description: 'Invitation ID',
    type: String,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation resent successfully',
    type: ResendInvitationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot resend accepted/cancelled invitation',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Invitation does not belong to this project',
  })
  async resendInvitation(
    @Param('projectId') projectId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser('id') senderId: string,
  ): Promise<ResendInvitationResponseDto> {
    return await this.membersService.resendInvitation(invitationId, projectId, senderId);
  }
}

// =============================================================================
// INVITATIONS CONTROLLER - Public (no project context)
// =============================================================================

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly membersService: MembersService) {}

  /**
   * Accept an invitation
   * Requires authentication but no project role (user is joining)
   */
  @Post('accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept an invitation',
    description: `
      Accepts an invitation using the token received via email.
      - Validates token and expiration
      - Verifies authenticated user's email matches invitation
      - Creates ProjectMember record
      - Activates user if pending verification
    `,
  })
  @ApiBody({ type: AcceptInvitationDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invitation accepted successfully',
    type: AcceptInvitationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid, expired, or already used invitation',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Email mismatch - invitation sent to different address',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @CurrentUser('id') userId: string,
  ): Promise<AcceptInvitationResponseDto> {
    return await this.membersService.acceptInvitation(dto.token, userId);
  }
}