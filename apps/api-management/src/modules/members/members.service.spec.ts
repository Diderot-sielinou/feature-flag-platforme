// import {
//   ConflictException,
//   NotFoundException,
//   ForbiddenException,
//   BadRequestException,
// } from '@nestjs/common';
// import { Test, type TestingModule } from '@nestjs/testing';
// import { ProjectRole } from '@repo/shared';

// import { PrismaService } from '../database/prisma.service';
// import { EventsService } from '../events/events.service';

// import { MembersService } from './members.service';

// describe('MembersService', () => {
//   let service: MembersService;
//   let prismaService: jest.Mocked<PrismaService>;
//   let eventsService: jest.Mocked<EventsService>;

//   const mockUser = {
//     id: 'user-123',
//     email: 'test@example.com',
//     name: 'Test User',
//     externalId: 'clerk-123',
//   };

//   const mockProject = {
//     id: 'proj-123',
//     name: 'Test Project',
//     ownerId: 'owner-123',
//   };

//   const mockMember = {
//     id: 'member-123',
//     userId: mockUser.id,
//     projectId: mockProject.id,
//     role: ProjectRole.EDITOR,
//     user: mockUser,
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   };

//   const mockInvitation = {
//     id: 'inv-123',
//     projectId: mockProject.id,
//     email: 'invited@example.com',
//     role: ProjectRole.VIEWER,
//     token: 'test-token',
//     status: 'PENDING',
//     expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
//     senderId: 'owner-123',
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   };

//   beforeEach(async () => {
//     const mockPrismaService = {
//       project: {
//         findUnique: jest.fn(),
//       },
//       projectMember: {
//         findMany: jest.fn(),
//         findUnique: jest.fn(),
//         create: jest.fn(),
//         update: jest.fn(),
//         delete: jest.fn(),
//       },
//       invitation: {
//         findMany: jest.fn(),
//         findUnique: jest.fn(),
//         findFirst: jest.fn(),
//         create: jest.fn(),
//         update: jest.fn(),
//       },
//       user: {
//         findUnique: jest.fn(),
//       },
//       $transaction: jest.fn((callback) => callback(mockPrismaService)),
//     };

//     const mockEventsService = {
//       emitMemberInvited: jest.fn().mockResolvedValue(undefined),
//       emitMemberRemoved: jest.fn().mockResolvedValue(undefined),
//     };

//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         MembersService,
//         { provide: PrismaService, useValue: mockPrismaService },
//         { provide: EventsService, useValue: mockEventsService },
//       ],
//     }).compile();

//     service = module.get<MembersService>(MembersService);
//     prismaService = module.get(PrismaService);
//     eventsService = module.get(EventsService);
//   });

//   it('should be defined', () => {
//     expect(service).toBeDefined();
//   });

//   describe('findAllMembers', () => {
//     it('should return owner and all members', async () => {
//       prismaService.project.findUnique.mockResolvedValue({
//         ...mockProject,
//         owner: { id: 'owner-123', email: 'owner@example.com', name: 'Owner' },
//       } as any);
//       prismaService.projectMember.findMany.mockResolvedValue([mockMember] as any);

//       const result = await service.findAllMembers('proj-123');

//       expect(result).toHaveLength(2); // owner + 1 member
//       expect(result[0].role).toBe(ProjectRole.OWNER);
//     });
//   });

//   describe('updateMemberRole', () => {
//     it('should update member role', async () => {
//       prismaService.project.findUnique.mockResolvedValue(mockProject as any);
//       prismaService.projectMember.findUnique.mockResolvedValue(mockMember as any);
//       prismaService.projectMember.update.mockResolvedValue({
//         ...mockMember,
//         role: ProjectRole.ADMIN,
//       } as any);

//       const result = await service.updateMemberRole(
//         'proj-123',
//         mockUser.id,
//         ProjectRole.ADMIN,
//       );

//       expect(result.role).toBe(ProjectRole.ADMIN);
//     });

//     it('should throw ForbiddenException when trying to change owner role', async () => {
//       prismaService.project.findUnique.mockResolvedValue(mockProject as any);

//       await expect(
//         service.updateMemberRole('proj-123', 'owner-123', ProjectRole.ADMIN),
//       ).rejects.toThrow(ForbiddenException);
//     });

//     it('should throw BadRequestException when assigning OWNER role', async () => {
//       prismaService.project.findUnique.mockResolvedValue(mockProject as any);
//       prismaService.projectMember.findUnique.mockResolvedValue(mockMember as any);

//       await expect(
//         service.updateMemberRole('proj-123', mockUser.id, ProjectRole.OWNER),
//       ).rejects.toThrow(BadRequestException);
//     });

//     it('should throw NotFoundException if member not found', async () => {
//       prismaService.project.findUnique.mockResolvedValue(mockProject as any);
//       prismaService.projectMember.findUnique.mockResolvedValue(null);

//       await expect(
//         service.updateMemberRole('proj-123', 'non-existent', ProjectRole.ADMIN),
//       ).rejects.toThrow(NotFoundException);
//     });
//   });

//   describe('removeMember', () => {
//     it('should remove a member', async () => {
//       prismaService.project.findUnique.mockResolvedValue(mockProject as any);
//       prismaService.projectMember.findUnique.mockResolvedValue(mockMember as any);
//       prismaService.projectMember.delete.mockResolvedValue(mockMember as any);

//       const result = await service.removeMember('proj-123', mockUser.id);

//       expect(result).toEqual({ removed: true, userId: mockUser.id });
//       expect(eventsService.emitMemberRemoved).toHaveBeenCalled();
//     });

//     it('should throw ForbiddenException when trying to remove owner', async () => {
//       prismaService.project.findUnique.mockResolvedValue(mockProject as any);

//       await expect(
//         service.removeMember('proj-123', 'owner-123'),
//       ).rejects.toThrow(ForbiddenException);
//     });
//   });

//   describe('inviteMember', () => {
//     it('should create an invitation', async () => {
//       prismaService.project.findUnique.mockResolvedValue({
//         ...mockProject,
//         owner: { email: 'owner@example.com' },
//       } as any);
//       prismaService.user.findUnique.mockResolvedValue(null); // User doesn't exist yet
//       prismaService.projectMember.findFirst = jest.fn().mockResolvedValue(null);
//       prismaService.invitation.findFirst.mockResolvedValue(null);
//       prismaService.invitation.create.mockResolvedValue(mockInvitation as any);

//       const result = await service.inviteMember(
//         'proj-123',
//         { email: 'invited@example.com', role: ProjectRole.VIEWER },
//         'owner-123',
//       );

//       expect(result).toBeDefined();
//       expect(result.email).toBe('invited@example.com');
//       expect(eventsService.emitMemberInvited).toHaveBeenCalled();
//     });

//     it('should throw ConflictException if user is already owner', async () => {
//       prismaService.project.findUnique.mockResolvedValue({
//         ...mockProject,
//         owner: { email: 'invited@example.com' },
//       } as any);

//       await expect(
//         service.inviteMember(
//           'proj-123',
//           { email: 'invited@example.com', role: ProjectRole.VIEWER },
//           'other-user',
//         ),
//       ).rejects.toThrow(ConflictException);
//     });

//     it('should throw ConflictException if pending invitation exists', async () => {
//       prismaService.project.findUnique.mockResolvedValue({
//         ...mockProject,
//         owner: { email: 'owner@example.com' },
//       } as any);
//       prismaService.user.findUnique.mockResolvedValue(null);
//       prismaService.projectMember.findFirst = jest.fn().mockResolvedValue(null);
//       prismaService.invitation.findFirst.mockResolvedValue(mockInvitation as any);

//       await expect(
//         service.inviteMember(
//           'proj-123',
//           { email: 'invited@example.com', role: ProjectRole.VIEWER },
//           'owner-123',
//         ),
//       ).rejects.toThrow(ConflictException);
//     });
//   });

//   describe('acceptInvitation', () => {
//     it('should accept invitation and create member', async () => {
//       const validInvitation = {
//         ...mockInvitation,
//         project: mockProject,
//       };

//       prismaService.invitation.findFirst.mockResolvedValue(validInvitation as any);
//       prismaService.invitation.update.mockResolvedValue({
//         ...validInvitation,
//         status: 'ACCEPTED',
//       } as any);
//       prismaService.projectMember.create.mockResolvedValue(mockMember as any);

//       const result = await service.acceptInvitation('test-token', mockUser.id, 'invited@example.com');

//       expect(result).toBeDefined();
//       expect(prismaService.invitation.update).toHaveBeenCalledWith(
//         expect.objectContaining({
//           data: expect.objectContaining({ status: 'ACCEPTED' }),
//         }),
//       );
//     });

//     it('should throw NotFoundException for invalid token', async () => {
//       prismaService.invitation.findFirst.mockResolvedValue(null);

//       await expect(
//         service.acceptInvitation('invalid-token', mockUser.id, 'test@example.com'),
//       ).rejects.toThrow(NotFoundException);
//     });

//     it('should throw BadRequestException for expired invitation', async () => {
//       const expiredInvitation = {
//         ...mockInvitation,
//         expiresAt: new Date(Date.now() - 1000), // Expired
//       };

//       prismaService.invitation.findFirst.mockResolvedValue(expiredInvitation as any);

//       await expect(
//         service.acceptInvitation('test-token', mockUser.id, 'invited@example.com'),
//       ).rejects.toThrow(BadRequestException);
//     });

//     it('should throw BadRequestException for email mismatch', async () => {
//       prismaService.invitation.findFirst.mockResolvedValue(mockInvitation as any);

//       await expect(
//         service.acceptInvitation('test-token', mockUser.id, 'wrong@example.com'),
//       ).rejects.toThrow(BadRequestException);
//     });
//   });

//   describe('getPendingInvitations', () => {
//     it('should return pending invitations', async () => {
//       const invitations = [mockInvitation];
//       prismaService.invitation.findMany.mockResolvedValue(invitations as any);

//       const result = await service.getPendingInvitations('proj-123');

//       expect(result).toHaveLength(1);
//       expect(result[0].status).toBe('PENDING');
//     });

//     it('should mark expired invitations', async () => {
//       const expiredInvitation = {
//         ...mockInvitation,
//         expiresAt: new Date(Date.now() - 1000),
//       };
//       prismaService.invitation.findMany.mockResolvedValue([expiredInvitation] as any);

//       const result = await service.getPendingInvitations('proj-123');

//       expect(result[0].isExpired).toBe(true);
//     });
//   });

//   describe('cancelInvitation', () => {
//     it('should cancel an invitation', async () => {
//       prismaService.invitation.findUnique.mockResolvedValue(mockInvitation as any);
//       prismaService.invitation.update.mockResolvedValue({
//         ...mockInvitation,
//         status: 'CANCELLED',
//       } as any);

//       const result = await service.cancelInvitation('inv-123', 'proj-123');

//       expect(result.status).toBe('CANCELLED');
//     });

//     it('should throw NotFoundException if invitation not found', async () => {
//       prismaService.invitation.findUnique.mockResolvedValue(null);

//       await expect(
//         service.cancelInvitation('non-existent', 'proj-123'),
//       ).rejects.toThrow(NotFoundException);
//     });
//   });

//   describe('resendInvitation', () => {
//     it('should resend invitation with new token', async () => {
//       prismaService.invitation.findUnique.mockResolvedValue(mockInvitation as any);
//       prismaService.invitation.update.mockResolvedValue({
//         ...mockInvitation,
//         token: 'new-token',
//       } as any);

//       const result = await service.resendInvitation('inv-123', 'proj-123');

//       expect(result).toBeDefined();
//       expect(prismaService.invitation.update).toHaveBeenCalled();
//       expect(eventsService.emitMemberInvited).toHaveBeenCalled();
//     });
//   });
// });
