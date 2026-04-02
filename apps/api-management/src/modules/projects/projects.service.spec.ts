// import { ConflictException, NotFoundException } from '@nestjs/common';
// import { Test, type TestingModule } from '@nestjs/testing';

// import { PrismaService } from '../database/prisma.service';
// import { RedisService } from '../redis/redis.service';

// import { ProjectsService } from './projects.service';

// describe('ProjectsService', () => {
//   let service: ProjectsService;
//   let prismaService: jest.Mocked<PrismaService>;
//   let redisService: jest.Mocked<RedisService>;

//   const mockUser = {
//     id: 'user-123',
//     email: 'test@example.com',
//     cognitoId: 'cognito-123',
//   };

//   const mockProject = {
//     id: 'proj-123',
//     name: 'Test Project',
//     slug: 'test-project',
//     description: 'A test project',
//     ownerId: mockUser.id,
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   };

//   beforeEach(async () => {
//     const mockPrismaService = {
//       project: {
//         findUnique: jest.fn(),
//         findMany: jest.fn(),
//         create: jest.fn(),
//         update: jest.fn(),
//         delete: jest.fn(),
//       },
//       projectMember: {
//         findMany: jest.fn(),
//         findUnique: jest.fn(),
//       },
//       environment: {
//         create: jest.fn(),
//         findMany: jest.fn(),
//       },
//       $transaction: jest.fn((callback) => callback(mockPrismaService)),
//     };

//     const mockRedisService = {
//       del: jest.fn().mockResolvedValue(true),
//       delPattern: jest.fn().mockResolvedValue(0),
//     };

//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         ProjectsService,
//         { provide: PrismaService, useValue: mockPrismaService },
//         { provide: RedisService, useValue: mockRedisService },
//       ],
//     }).compile();

//     service = module.get<ProjectsService>(ProjectsService);
//     prismaService = module.get(PrismaService);
//     redisService = module.get(RedisService);
//   });

//   it('should be defined', () => {
//     expect(service).toBeDefined();
//   });

//   describe('create', () => {
//     it('should create a project with default environments', async () => {
//       const createDto = {
//         name: 'New Project',
//         description: 'A new project',
//       };

//       prismaService.project.findUnique.mockResolvedValue(null);
//       prismaService.project.create.mockResolvedValue({
//         ...mockProject,
//         name: createDto.name,
//         slug: 'new-project',
//       });
//       prismaService.environment.create.mockResolvedValue({
//         id: 'env-123',
//         name: 'development',
//         projectId: mockProject.id,
//       } as any);
//       prismaService.project.findUnique.mockResolvedValue({
//         ...mockProject,
//         owner: mockUser,
//         environments: [],
//         _count: { flags: 0 },
//       } as any);

//       const result = await service.create(createDto, mockUser.id);

//       expect(result).toBeDefined();
//       expect(prismaService.project.create).toHaveBeenCalled();
//     });

//     it('should throw ConflictException if slug already exists', async () => {
//       const createDto = {
//         name: 'Test Project',
//         slug: 'test-project',
//       };

//       prismaService.project.findUnique.mockResolvedValue(mockProject as any);

//       await expect(service.create(createDto, mockUser.id)).rejects.toThrow(
//         ConflictException,
//       );
//     });
//   });

//   describe('findAll', () => {
//     it('should return projects owned and member projects', async () => {
//       prismaService.project.findMany.mockResolvedValue([mockProject as any]);
//       prismaService.projectMember.findMany.mockResolvedValue([]);

//       const result = await service.findAll(mockUser.id);

//       expect(result).toBeDefined();
//       expect(Array.isArray(result)).toBe(true);
//     });
//   });

//   describe('findOne', () => {
//     it('should return a project by id', async () => {
//       prismaService.project.findUnique.mockResolvedValue({
//         ...mockProject,
//         owner: mockUser,
//         environments: [],
//         _count: { flags: 0 },
//       } as any);

//       const result = await service.findOne(mockProject.id);

//       expect(result).toBeDefined();
//       expect(result.id).toBe(mockProject.id);
//     });

//     it('should throw NotFoundException if project not found', async () => {
//       prismaService.project.findUnique.mockResolvedValue(null);

//       await expect(service.findOne('non-existent')).rejects.toThrow(
//         NotFoundException,
//       );
//     });
//   });

//   describe('update', () => {
//     it('should update a project', async () => {
//       const updateDto = { name: 'Updated Project' };

//       prismaService.project.findUnique.mockResolvedValue(mockProject as any);
//       prismaService.project.update.mockResolvedValue({
//         ...mockProject,
//         ...updateDto,
//       } as any);

//       // Mock findOne for the return
//       prismaService.project.findUnique.mockResolvedValueOnce(mockProject as any);
//       prismaService.project.findUnique.mockResolvedValueOnce({
//         ...mockProject,
//         ...updateDto,
//         owner: mockUser,
//         environments: [],
//         _count: { flags: 0 },
//       } as any);

//       const result = await service.update(mockProject.id, updateDto, mockUser.id);

//       expect(result).toBeDefined();
//     });

//     it('should throw NotFoundException if project not found', async () => {
//       prismaService.project.findUnique.mockResolvedValue(null);

//       await expect(
//         service.update('non-existent', { name: 'Test' }, mockUser.id),
//       ).rejects.toThrow(NotFoundException);
//     });
//   });

//   describe('delete', () => {
//     it('should delete a project', async () => {
//       prismaService.project.findUnique.mockResolvedValue(mockProject as any);
//       prismaService.project.delete.mockResolvedValue(mockProject as any);

//       const result = await service.delete(mockProject.id, mockUser.id);

//       expect(result).toEqual({ deleted: true, id: mockProject.id });
//       expect(redisService.delPattern).toHaveBeenCalled();
//     });

//     it('should throw NotFoundException if project not found', async () => {
//       prismaService.project.findUnique.mockResolvedValue(null);

//       await expect(service.delete('non-existent', mockUser.id)).rejects.toThrow(
//         NotFoundException,
//       );
//     });
//   });

//   describe('hasAccess', () => {
//     it('should return true for project owner', async () => {
//       prismaService.project.findUnique.mockResolvedValue(mockProject as any);
//       prismaService.projectMember.findUnique.mockResolvedValue(null);

//       const result = await service.hasAccess(mockProject.id, mockUser.id);

//       expect(result).toBe(true);
//     });

//     it('should return true for project member', async () => {
//       prismaService.project.findUnique.mockResolvedValue({
//         ...mockProject,
//         ownerId: 'other-user',
//       } as any);
//       prismaService.projectMember.findUnique.mockResolvedValue({
//         id: 'member-123',
//         userId: mockUser.id,
//         projectId: mockProject.id,
//       } as any);

//       const result = await service.hasAccess(mockProject.id, mockUser.id);

//       expect(result).toBe(true);
//     });

//     it('should return false for non-member', async () => {
//       prismaService.project.findUnique.mockResolvedValue({
//         ...mockProject,
//         ownerId: 'other-user',
//       } as any);
//       prismaService.projectMember.findUnique.mockResolvedValue(null);

//       const result = await service.hasAccess(mockProject.id, mockUser.id);

//       expect(result).toBe(false);
//     });
//   });
// });
