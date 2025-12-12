// import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
// import { Test, type TestingModule } from '@nestjs/testing';

// import { PrismaService } from '../database/prisma.service';
// import { EventsService } from '../events/events.service';
// import { RedisService } from '../redis/redis.service';

// import { FlagsService } from './flags.service';
// import { RulesService } from './rules.service';

// describe('FlagsService', () => {
//   let service: FlagsService;
//   let prismaService: jest.Mocked<PrismaService>;
//   let redisService: jest.Mocked<RedisService>;
//   let eventsService: jest.Mocked<EventsService>;
//   let rulesService: RulesService;

//   const mockFlag = {
//     id: 'flag-123',
//     projectId: 'proj-123',
//     key: 'test_flag',
//     name: 'Test Flag',
//     description: 'A test flag',
//     tags: ['test'],
//     archived: false,
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   };

//   const mockFlagState = {
//     id: 'state-123',
//     flagId: mockFlag.id,
//     envId: 'env-123',
//     defaultState: false,
//     rules: {
//       version: 1,
//       priority: ['entityList', 'attributeMatch', 'percentage', 'default'],
//       entityList: { whitelist: [], blacklist: [] },
//       attributeMatch: [],
//       percentage: { salt: '', rollout: 0 },
//     },
//     version: 1,
//     updatedBy: 'user-123',
//     updatedAt: new Date(),
//   };

//   beforeEach(async () => {
//     const mockPrismaService = {
//       flag: {
//         findUnique: jest.fn(),
//         findMany: jest.fn(),
//         create: jest.fn(),
//         update: jest.fn(),
//         delete: jest.fn(),
//       },
//       flagEnvironmentState: {
//         findUnique: jest.fn(),
//         create: jest.fn(),
//         update: jest.fn(),
//       },
//       flagStateHistory: {
//         create: jest.fn(),
//         findFirst: jest.fn(),
//         findMany: jest.fn(),
//       },
//       environment: {
//         findMany: jest.fn(),
//       },
//       $transaction: jest.fn((callback) => callback(mockPrismaService)),
//     };

//     const mockRedisService = {
//       invalidateFlagCache: jest.fn().mockResolvedValue(undefined),
//     };

//     const mockEventsService = {
//       emitFlagCreated: jest.fn().mockResolvedValue(undefined),
//       emitFlagUpdated: jest.fn().mockResolvedValue(undefined),
//       emitFlagStateChanged: jest.fn().mockResolvedValue(undefined),
//       emitFlagDeleted: jest.fn().mockResolvedValue(undefined),
//     };

//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         FlagsService,
//         RulesService,
//         { provide: PrismaService, useValue: mockPrismaService },
//         { provide: RedisService, useValue: mockRedisService },
//         { provide: EventsService, useValue: mockEventsService },
//       ],
//     }).compile();

//     service = module.get<FlagsService>(FlagsService);
//     prismaService = module.get(PrismaService);
//     redisService = module.get(RedisService);
//     eventsService = module.get(EventsService);
//     rulesService = module.get(RulesService);
//   });

//   it('should be defined', () => {
//     expect(service).toBeDefined();
//   });

//   describe('create', () => {
//     it('should create a flag with states for all environments', async () => {
//       const createDto = {
//         key: 'new_feature',
//         name: 'New Feature',
//         description: 'A new feature flag',
//       };

//       prismaService.flag.findUnique.mockResolvedValueOnce(null); // Check existing
//       prismaService.environment.findMany.mockResolvedValue([
//         { id: 'env-1' },
//         { id: 'env-2' },
//       ] as any);
//       prismaService.flag.create.mockResolvedValue({
//         ...mockFlag,
//         key: createDto.key,
//         name: createDto.name,
//       } as any);
//       prismaService.flagEnvironmentState.create.mockResolvedValue(mockFlagState as any);

//       // Mock findOne
//       prismaService.flag.findUnique.mockResolvedValueOnce({
//         ...mockFlag,
//         environmentStates: [mockFlagState],
//       } as any);

//       const result = await service.create('proj-123', createDto, 'user-123');

//       expect(result).toBeDefined();
//       expect(prismaService.flag.create).toHaveBeenCalled();
//       expect(eventsService.emitFlagCreated).toHaveBeenCalled();
//     });

//     it('should throw ConflictException if flag key exists', async () => {
//       prismaService.flag.findUnique.mockResolvedValue(mockFlag as any);

//       await expect(
//         service.create('proj-123', { key: 'test_flag', name: 'Test' }, 'user-123'),
//       ).rejects.toThrow(ConflictException);
//     });
//   });

//   describe('findOne', () => {
//     it('should return a flag with environment states', async () => {
//       prismaService.flag.findUnique.mockResolvedValue({
//         ...mockFlag,
//         environmentStates: [
//           {
//             ...mockFlagState,
//             environment: { id: 'env-123', name: 'development', type: 'development', color: '#6366F1' },
//           },
//         ],
//       } as any);

//       const result = await service.findOne(mockFlag.id);

//       expect(result).toBeDefined();
//       expect(result.id).toBe(mockFlag.id);
//       expect(result.environmentStates).toHaveLength(1);
//     });

//     it('should throw NotFoundException if flag not found', async () => {
//       prismaService.flag.findUnique.mockResolvedValue(null);

//       await expect(service.findOne('non-existent')).rejects.toThrow(
//         NotFoundException,
//       );
//     });
//   });

//   describe('updateState', () => {
//     it('should update flag state and emit event', async () => {
//       prismaService.flagEnvironmentState.findUnique.mockResolvedValue({
//         ...mockFlagState,
//         flag: { key: mockFlag.key, projectId: mockFlag.projectId },
//       } as any);
//       prismaService.flagStateHistory.create.mockResolvedValue({} as any);
//       prismaService.flagEnvironmentState.update.mockResolvedValue({
//         ...mockFlagState,
//         defaultState: true,
//         version: 2,
//       } as any);

//       const result = await service.updateState(
//         mockFlag.id,
//         'env-123',
//         { defaultState: true },
//         'user-123',
//       );

//       expect(redisService.invalidateFlagCache).toHaveBeenCalled();
//       expect(eventsService.emitFlagStateChanged).toHaveBeenCalled();
//     });

//     it('should throw NotFoundException if state not found', async () => {
//       prismaService.flagEnvironmentState.findUnique.mockResolvedValue(null);

//       await expect(
//         service.updateState('flag-123', 'env-123', { defaultState: true }, 'user-123'),
//       ).rejects.toThrow(NotFoundException);
//     });
//   });

//   describe('updateRules', () => {
//     it('should update rules and save history', async () => {
//       const newRules = {
//         version: 1,
//         priority: ['entityList', 'attributeMatch', 'percentage', 'default'] as const,
//         entityList: { whitelist: ['user-1'], blacklist: [] },
//         attributeMatch: [],
//         percentage: { salt: '', rollout: 0 },
//       };

//       prismaService.flagEnvironmentState.findUnique.mockResolvedValue({
//         ...mockFlagState,
//         flag: { key: mockFlag.key, projectId: mockFlag.projectId },
//       } as any);
//       prismaService.flagStateHistory.create.mockResolvedValue({} as any);
//       prismaService.flagEnvironmentState.update.mockResolvedValue({
//         ...mockFlagState,
//         rules: newRules,
//         version: 2,
//       } as any);

//       const result = await service.updateRules(
//         mockFlag.id,
//         'env-123',
//         { rules: newRules },
//         'user-123',
//       );

//       expect(prismaService.flagStateHistory.create).toHaveBeenCalled();
//       expect(eventsService.emitFlagUpdated).toHaveBeenCalled();
//     });
//   });

//   describe('addToWhitelist', () => {
//     it('should add entities to whitelist', async () => {
//       prismaService.flagEnvironmentState.findUnique.mockResolvedValue({
//         ...mockFlagState,
//         flag: { key: mockFlag.key, projectId: mockFlag.projectId },
//       } as any);
//       prismaService.flagStateHistory.create.mockResolvedValue({} as any);
//       prismaService.flagEnvironmentState.update.mockResolvedValue({
//         ...mockFlagState,
//         version: 2,
//       } as any);

//       const result = await service.addToWhitelist(
//         mockFlag.id,
//         'env-123',
//         ['entity-1', 'entity-2'],
//         'user-123',
//       );

//       expect(result.added).toBe(2);
//     });
//   });

//   describe('rollback', () => {
//     it('should rollback to a previous version', async () => {
//       const historyEntry = {
//         id: 'history-123',
//         stateId: mockFlagState.id,
//         version: 1,
//         defaultState: true,
//         rules: mockFlagState.rules,
//         changedBy: 'user-123',
//         createdAt: new Date(),
//       };

//       prismaService.flagEnvironmentState.findUnique.mockResolvedValue({
//         ...mockFlagState,
//         flag: { key: mockFlag.key, projectId: mockFlag.projectId },
//       } as any);
//       prismaService.flagStateHistory.findFirst.mockResolvedValue(historyEntry as any);
//       prismaService.flagStateHistory.create.mockResolvedValue({} as any);
//       prismaService.flagEnvironmentState.update.mockResolvedValue({
//         ...mockFlagState,
//         defaultState: historyEntry.defaultState,
//         version: 3,
//       } as any);

//       const result = await service.rollback(mockFlag.id, 'env-123', 1, 'user-123');

//       expect(prismaService.flagStateHistory.findFirst).toHaveBeenCalledWith({
//         where: { stateId: mockFlagState.id, version: 1 },
//       });
//     });

//     it('should throw NotFoundException if version not found', async () => {
//       prismaService.flagEnvironmentState.findUnique.mockResolvedValue({
//         ...mockFlagState,
//         flag: { key: mockFlag.key, projectId: mockFlag.projectId },
//       } as any);
//       prismaService.flagStateHistory.findFirst.mockResolvedValue(null);

//       await expect(
//         service.rollback(mockFlag.id, 'env-123', 999, 'user-123'),
//       ).rejects.toThrow(NotFoundException);
//     });
//   });

//   describe('delete', () => {
//     it('should delete a flag and invalidate cache', async () => {
//       prismaService.flag.findUnique.mockResolvedValue({
//         ...mockFlag,
//         environmentStates: [{ envId: 'env-123' }],
//       } as any);
//       prismaService.flag.delete.mockResolvedValue(mockFlag as any);

//       const result = await service.delete(mockFlag.id, mockFlag.projectId, 'user-123');

//       expect(result).toEqual({ deleted: true, id: mockFlag.id });
//       expect(redisService.invalidateFlagCache).toHaveBeenCalled();
//       expect(eventsService.emitFlagDeleted).toHaveBeenCalled();
//     });
//   });
// });
