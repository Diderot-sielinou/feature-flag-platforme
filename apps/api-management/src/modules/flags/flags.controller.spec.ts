// import { Test, type TestingModule } from '@nestjs/testing';

// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';

// import { FlagsController } from './flags.controller';
// import { FlagsService } from './flags.service';

// describe('FlagsController', () => {
//   let controller: FlagsController;
//   let service: jest.Mocked<FlagsService>;

//   const mockUser = {
//     id: 'user-123',
//     email: 'test@example.com',
//   };

//   const mockFlag = {
//     id: 'flag-123',
//     projectId: 'proj-123',
//     key: 'test_feature',
//     name: 'Test Feature',
//     description: 'A test feature flag',
//     tags: ['test'],
//     archived: false,
//     environmentStates: [
//       {
//         id: 'state-123',
//         envId: 'env-123',
//         defaultState: false,
//         rules: {
//           version: 1,
//           priority: ['default'],
//         },
//         version: 1,
//         environment: {
//           id: 'env-123',
//           name: 'development',
//           type: 'development',
//         },
//       },
//     ],
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   };

//   beforeEach(async () => {
//     const mockFlagsService = {
//       create: jest.fn(),
//       findAllByProject: jest.fn(),
//       findOne: jest.fn(),
//       findByKey: jest.fn(),
//       getFlagState: jest.fn(),
//       update: jest.fn(),
//       updateState: jest.fn(),
//       updateRules: jest.fn(),
//       addToWhitelist: jest.fn(),
//       addToBlacklist: jest.fn(),
//       copyConfig: jest.fn(),
//       rollback: jest.fn(),
//       getHistory: jest.fn(),
//       delete: jest.fn(),
//     };

//     const module: TestingModule = await Test.createTestingModule({
//       controllers: [FlagsController],
//       providers: [
//         { provide: FlagsService, useValue: mockFlagsService },
//       ],
//     })
//       .overrideGuard(JwtAuthGuard)
//       .useValue({ canActivate: () => true })
//       .overrideGuard(RolesGuard)
//       .useValue({ canActivate: () => true })
//       .compile();

//     controller = module.get<FlagsController>(FlagsController);
//     service = module.get(FlagsService);
//   });

//   it('should be defined', () => {
//     expect(controller).toBeDefined();
//   });

//   describe('create', () => {
//     it('should create a flag', async () => {
//       const createDto = {
//         key: 'new_feature',
//         name: 'New Feature',
//       };

//       service.create.mockResolvedValue(mockFlag as any);

//       const req = { user: mockUser } as any;
//       const result = await controller.create('proj-123', createDto, req);

//       expect(result.success).toBe(true);
//       expect(result.data.key).toBe(mockFlag.key);
//     });
//   });

//   describe('findAll', () => {
//     it('should return all flags', async () => {
//       service.findAllByProject.mockResolvedValue([mockFlag] as any);

//       const result = await controller.findAll('proj-123', {});

//       expect(result.success).toBe(true);
//       expect(result.data).toHaveLength(1);
//     });

//     it('should filter by tags', async () => {
//       service.findAllByProject.mockResolvedValue([mockFlag] as any);

//       const result = await controller.findAll('proj-123', { tags: 'test' });

//       expect(service.findAllByProject).toHaveBeenCalledWith(
//         'proj-123',
//         expect.objectContaining({ tags: ['test'] }),
//       );
//     });
//   });

//   describe('findOne', () => {
//     it('should return a flag by id', async () => {
//       service.findOne.mockResolvedValue(mockFlag as any);

//       const result = await controller.findOne('proj-123', mockFlag.id);

//       expect(result.success).toBe(true);
//       expect(result.data.id).toBe(mockFlag.id);
//     });
//   });

//   describe('findByKey', () => {
//     it('should return a flag by key', async () => {
//       service.findByKey.mockResolvedValue(mockFlag as any);

//       const result = await controller.findByKey('proj-123', mockFlag.key);

//       expect(result.success).toBe(true);
//       expect(result.data.key).toBe(mockFlag.key);
//     });
//   });

//   describe('getFlagState', () => {
//     it('should return flag state for environment', async () => {
//       const state = mockFlag.environmentStates[0];
//       service.getFlagState.mockResolvedValue(state as any);

//       const result = await controller.getFlagState(
//         'proj-123',
//         mockFlag.id,
//         'env-123',
//       );

//       expect(result.success).toBe(true);
//       expect(result.data.envId).toBe('env-123');
//     });
//   });

//   describe('updateState', () => {
//     it('should update flag state', async () => {
//       const updatedState = { ...mockFlag.environmentStates[0], defaultState: true };
//       service.updateState.mockResolvedValue(updatedState as any);

//       const req = { user: mockUser } as any;
//       const result = await controller.updateState(
//         'proj-123',
//         mockFlag.id,
//         'env-123',
//         { defaultState: true },
//         req,
//       );

//       expect(result.success).toBe(true);
//       expect(result.data.defaultState).toBe(true);
//     });
//   });

//   describe('updateRules', () => {
//     it('should update flag rules', async () => {
//       const newRules = {
//         version: 2,
//         priority: ['entityList', 'default'],
//         entityList: { whitelist: ['user-1'], blacklist: [] },
//       };
//       const updatedState = {
//         ...mockFlag.environmentStates[0],
//         rules: newRules,
//         version: 2,
//       };
//       service.updateRules.mockResolvedValue(updatedState as any);

//       const req = { user: mockUser } as any;
//       const result = await controller.updateRules(
//         'proj-123',
//         mockFlag.id,
//         'env-123',
//         { rules: newRules as any },
//         req,
//       );

//       expect(result.success).toBe(true);
//       expect(result.data.rules.entityList.whitelist).toContain('user-1');
//     });
//   });

//   describe('addToWhitelist', () => {
//     it('should add entities to whitelist', async () => {
//       service.addToWhitelist.mockResolvedValue({ added: 2, current: 2 });

//       const req = { user: mockUser } as any;
//       const result = await controller.addToWhitelist(
//         'proj-123',
//         mockFlag.id,
//         'env-123',
//         { entityIds: ['user-1', 'user-2'] },
//         req,
//       );

//       expect(result.success).toBe(true);
//       expect(result.data.added).toBe(2);
//     });
//   });

//   describe('addToBlacklist', () => {
//     it('should add entities to blacklist', async () => {
//       service.addToBlacklist.mockResolvedValue({ added: 1, current: 1 });

//       const req = { user: mockUser } as any;
//       const result = await controller.addToBlacklist(
//         'proj-123',
//         mockFlag.id,
//         'env-123',
//         { entityIds: ['banned-user'] },
//         req,
//       );

//       expect(result.success).toBe(true);
//       expect(result.data.added).toBe(1);
//     });
//   });

//   describe('copyConfig', () => {
//     it('should copy flag config between environments', async () => {
//       const copiedState = { ...mockFlag.environmentStates[0], envId: 'env-prod' };
//       service.copyConfig.mockResolvedValue(copiedState as any);

//       const req = { user: mockUser } as any;
//       const result = await controller.copyConfig(
//         'proj-123',
//         mockFlag.id,
//         { sourceEnvId: 'env-123', targetEnvId: 'env-prod' },
//         req,
//       );

//       expect(result.success).toBe(true);
//     });
//   });

//   describe('rollback', () => {
//     it('should rollback to previous version', async () => {
//       const rolledBackState = { ...mockFlag.environmentStates[0], version: 3 };
//       service.rollback.mockResolvedValue(rolledBackState as any);

//       const req = { user: mockUser } as any;
//       const result = await controller.rollback(
//         'proj-123',
//         mockFlag.id,
//         'env-123',
//         { targetVersion: 1 },
//         req,
//       );

//       expect(result.success).toBe(true);
//     });
//   });

//   describe('getHistory', () => {
//     it('should return flag history', async () => {
//       const history = [
//         { version: 1, changedBy: mockUser.id, createdAt: new Date() },
//         { version: 2, changedBy: mockUser.id, createdAt: new Date() },
//       ];
//       service.getHistory.mockResolvedValue(history as any);

//       const result = await controller.getHistory(
//         'proj-123',
//         mockFlag.id,
//         'env-123',
//       );

//       expect(result.success).toBe(true);
//       expect(result.data).toHaveLength(2);
//     });
//   });

//   describe('delete', () => {
//     it('should delete a flag', async () => {
//       service.delete.mockResolvedValue({ deleted: true, id: mockFlag.id });

//       const req = { user: mockUser } as any;
//       const result = await controller.delete('proj-123', mockFlag.id, req);

//       expect(result.success).toBe(true);
//       expect(result.data.deleted).toBe(true);
//     });
//   });
// });
