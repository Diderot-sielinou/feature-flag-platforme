// =============================================================================
// members/dto/member.dto.ts
// =============================================================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectRole, InvitationStatus } from '@prisma/client';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

// =============================================================================
// INPUT DTOs
// =============================================================================

/**
 * DTO for inviting a new member to a project
 */
export class InviteMemberDto {
  @ApiProperty({
    description: 'Email address of the person to invite',
    example: 'developer@example.com',
    maxLength: 255,
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description: 'Role to assign to the invited member',
    enum: [ProjectRole.ADMIN, ProjectRole.EDITOR, ProjectRole.VIEWER],
    example: ProjectRole.EDITOR,
    default: ProjectRole.VIEWER,
  })
  @IsEnum(ProjectRole, { message: 'Invalid role specified' })
  @IsNotEmpty({ message: 'Role is required' })
  role: ProjectRole;
}

/**
 * DTO for updating a member's role
 */
export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'New role to assign (cannot be OWNER)',
    enum: [ProjectRole.ADMIN, ProjectRole.EDITOR, ProjectRole.VIEWER],
    example: ProjectRole.EDITOR,
  })
  @IsEnum(ProjectRole, { message: 'Invalid role specified' })
  @IsNotEmpty({ message: 'Role is required' })
  role: ProjectRole;
}

/**
 * DTO for accepting an invitation
 */
export class AcceptInvitationDto {
  @ApiProperty({
    description: 'Invitation token received via email',
    example: 'abc123def456...',
  })
  @IsString({ message: 'Token must be a string' })
  @IsNotEmpty({ message: 'Token is required' })
  token: string;
}

// =============================================================================
// RESPONSE DTOs - User
// =============================================================================

/**
 * User details in member responses
 */
export class MemberUserDto {
  @ApiProperty({ description: 'User ID', example: 'clx1234567890' })
  id: string;

  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: 'Display name', example: 'John Doe' })
  name: string;

  @ApiPropertyOptional({
    description: 'Avatar URL',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  avatarUrl: string | null;
}

/**
 * Minimal user details (without avatar)
 */
export class MemberUserMinimalDto {
  @ApiProperty({ description: 'User ID', example: 'clx1234567890' })
  id: string;

  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: 'Display name', example: 'John Doe' })
  name: string;
}

// =============================================================================
// RESPONSE DTOs - Member
// =============================================================================

/**
 * Response DTO for a project member
 */
export class MemberResponseDto {
  @ApiProperty({
    description: 'Member relationship ID (or "owner-{userId}" for owner)',
    example: 'clx1234567890',
  })
  id: string;

  @ApiProperty({ description: 'Project ID', example: 'clx0987654321' })
  projectId: string;

  @ApiProperty({ description: 'User ID', example: 'clx1234567890' })
  userId: string;

  @ApiProperty({
    description: 'Role in the project',
    enum: ProjectRole,
    example: ProjectRole.EDITOR,
  })
  role: ProjectRole;

  @ApiProperty({ description: 'User details', type: MemberUserDto })
  user: MemberUserDto;

  @ApiProperty({ description: 'When the member joined' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({
    description: 'Whether this member is the project owner',
    example: false,
  })
  isOwner: boolean;
}

/**
 * Response after removing a member
 */
export class RemoveMemberResponseDto {
  @ApiProperty({ description: 'Removal success status', example: true })
  removed: boolean;

  @ApiProperty({ description: 'ID of the removed user', example: 'clx1234567890' })
  userId: string;
}

// =============================================================================
// RESPONSE DTOs - Invitation
// =============================================================================

/**
 * Response DTO for an invitation
 */
export class InvitationResponseDto {
  @ApiProperty({ description: 'Invitation ID', example: 'clx1234567890' })
  id: string;

  @ApiProperty({ description: 'Project ID', example: 'clx0987654321' })
  projectId: string;

  @ApiProperty({
    description: 'Invited email address',
    example: 'invitee@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Assigned role',
    enum: ProjectRole,
    example: ProjectRole.EDITOR,
  })
  role: ProjectRole;

  @ApiProperty({
    description: 'Invitation status',
    enum: InvitationStatus,
    example: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @ApiProperty({ description: 'Expiration date' })
  expiresAt: Date;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Whether the invitation has expired',
    example: false,
  })
  isExpired?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this is a new user (no existing account)',
    example: true,
  })
  isNewUser?: boolean;

  @ApiProperty({
    description: 'Sender details',
    type: MemberUserMinimalDto,
  })
  sender: MemberUserMinimalDto;
}

/**
 * Response after cancelling an invitation
 */
export class CancelInvitationResponseDto {
  @ApiProperty({ description: 'Cancellation success status', example: true })
  cancelled: boolean;

  @ApiProperty({ description: 'Invitation ID', example: 'clx1234567890' })
  id: string;
}

/**
 * Response after resending an invitation
 */
export class ResendInvitationResponseDto {
  @ApiProperty({ description: 'Invitation ID', example: 'clx1234567890' })
  id: string;

  @ApiProperty({ description: 'Invited email', example: 'invitee@example.com' })
  email: string;

  @ApiProperty({
    description: 'Assigned role',
    enum: ProjectRole,
    example: ProjectRole.EDITOR,
  })
  role: ProjectRole;

  @ApiProperty({ description: 'New expiration date' })
  expiresAt: Date;

  @ApiProperty({ description: 'Resend success status', example: true })
  resent: boolean;
}

/**
 * Project info in accept response
 */
export class AcceptedProjectDto {
  @ApiProperty({ description: 'Project ID', example: 'clx0987654321' })
  id: string;

  @ApiProperty({ description: 'Project name', example: 'My Awesome App' })
  name: string;

  @ApiProperty({ description: 'Project key/slug', example: 'my-awesome-app' })
  key: string;
}

/**
 * Response after accepting an invitation
 */
export class AcceptInvitationResponseDto {
  @ApiProperty({ description: 'Acceptance success status', example: true })
  accepted: boolean;

  @ApiProperty({
    description: 'Whether user was already a member',
    example: false,
  })
  alreadyMember: boolean;

  @ApiProperty({ description: 'Project details', type: AcceptedProjectDto })
  project: AcceptedProjectDto;

  @ApiProperty({
    description: 'Role assigned to the user',
    enum: ProjectRole,
    example: ProjectRole.EDITOR,
  })
  role: ProjectRole;

  @ApiPropertyOptional({
    description: 'Additional message',
    example: 'You are already a member of this project',
  })
  message?: string;
}