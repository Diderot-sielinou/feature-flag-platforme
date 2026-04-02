// /* eslint-disable import/order */
// // eslint-disable-next-line @typescript-eslint/consistent-type-imports
// import { Test, TestingModule } from '@nestjs/testing';
// import { ProjectsController } from './projects.controller';
// import { ProjectsService } from './projects.service';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';

// describe('ProjectsController', () => {
//   let controller: ProjectsController;
//   let service: jest.Mocked<ProjectsService>;

//   const mockUser = {
//     id: 'user-123',
//     email: 'test@example.com',
//   };

//   const mockProject = {
//     id: 'proj-123',
//     name: 'Test Project',
//     slug: 'test-project',
//     description: 'A test project',
//     ownerId: mockUser.id,
//     owner: mockUser,
//     environments: [],
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   };

//   beforeEach(async () => {
//     const mockProjectsService = {
//       create: jest.fn(),
//       findAll: jest.fn(),
//       findOne: jest.fn(),
//       update: jest.fn(),
//       delete: jest.fn(),
//     };

//     const module: TestingModule = await Test.createTestingModule({
//       controllers: [ProjectsController],
//       providers: [
//         { provide: ProjectsService, useValue: mockProjectsService },
//       ],
//     })
//       .overrideGuard(JwtAuthGuard)
//       .useValue({ canActivate: () => true })
//       .overrideGuard(RolesGuard)
//       .useValue({ canActivate: () => true })
//       .compile();

//     controller = module.get<ProjectsController>(ProjectsController);
//     service = module.get(ProjectsService);
//   });

//   it('should be defined', () => {
//     expect(controller).toBeDefined();
//   });

//   describe('create', () => {
//     it('should create a project', async () => {
//       const createDto = {
//         name: 'New Project',
//         description: 'A new project',
//       };

//       service.create.mockResolvedValue(mockProject as any);

//       const req = { user: mockUser } as any;
//       const result = await controller.create(createDto, req);

//       expect(result.success).toBe(true);
//       expect(result.data).toEqual(mockProject);
//       expect(service.create).toHaveBeenCalledWith(createDto, mockUser.id);
//     });
//   });

//   describe('findAll', () => {
//     it('should return all projects', async () => {
//       service.findAll.mockResolvedValue([mockProject] as any);

//       const req = { user: mockUser } as any;
//       const result = await controller.findAll(req);

//       expect(result.success).toBe(true);
//       expect(result.data).toHaveLength(1);
//     });
//   });

//   describe('findOne', () => {
//     it('should return a single project', async () => {
//       service.findOne.mockResolvedValue(mockProject as any);

//       const result = await controller.findOne(mockProject.id);

//       expect(result.success).toBe(true);
//       expect(result.data.id).toBe(mockProject.id);
//     });
//   });

//   describe('update', () => {
//     it('should update a project', async () => {
//       const updateDto = { name: 'Updated Project' };
//       service.update.mockResolvedValue({ ...mockProject, ...updateDto } as any);

//       const req = { user: mockUser } as any;
//       const result = await controller.update(mockProject.id, updateDto, req);

//       expect(result.success).toBe(true);
//       expect(result.data.name).toBe(updateDto.name);
//     });
//   });

//   describe('delete', () => {
//     it('should delete a project', async () => {
//       service.delete.mockResolvedValue({ deleted: true, id: mockProject.id });

//       const req = { user: mockUser } as any;
//       const result = await controller.delete(mockProject.id, req);

//       expect(result.success).toBe(true);
//       expect(result.data.deleted).toBe(true);
//     });
//   });
// });
