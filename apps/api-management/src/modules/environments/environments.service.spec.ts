import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentsService } from './environments.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventsService } from '../events/events.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('EnvironmentsService', () => {
  let service: EnvironmentsService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;
  let eventsService: jest.Mocked<EventsService>;

  const mockEnvironment = {
    id: 'env-123',
    projectId: 'proj-123',
    name: 'development',
    type: 'development',
    description: 'Development environment',
    color: '#6366F1',
    sortOrder: 0,
    apiKeyHash: 'hashed-key',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      environment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      flagEnvironmentState: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
    };

    const mockRedisService = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(true),
    };

    const mockEventsService = {
      emitEnvironmentCreated: jest.fn().mockResolvedValue(undefined),
      emitEnvironmentUpdated: jest.fn().mockResolvedValue(undefined),
      emitApiKeyRotated: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<EnvironmentsService>(EnvironmentsService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
    eventsService = module.get(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an environment with API key', async () => {
      const createDto = {
        name: 'staging',
        type: 'custom',
        description: 'Staging environment',
        color: '#10B981',
      };

      prismaService.environment.findFirst.mockResolvedValue(null);
      prismaService.environment.count.mockResolvedValue(2);
      prismaService.environment.create.mockResolvedValue({
        ...mockEnvironment,
        ...createDto,
        id: 'env-new',
      } as any);

      const result = await service.create('proj-123', createDto);

      expect(result).toBeDefined();
      expect(result.apiKey).toBeDefined(); // API key returned on creation
      expect(prismaService.environment.create).toHaveBeenCalled();
      expect(eventsService.emitEnvironmentCreated).toHaveBeenCalled();
    });

    it('should throw ConflictException if environment name exists', async () => {
      prismaService.environment.findFirst.mockResolvedValue(mockEnvironment as any);

      await expect(
        service.create('proj-123', { name: 'development', type: 'custom' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllByProject', () => {
    it('should return environments with stats', async () => {
      const environments = [
        { ...mockEnvironment, id: 'env-1' },
        { ...mockEnvironment, id: 'env-2', name: 'production' },
      ];

      prismaService.environment.findMany.mockResolvedValue(environments as any);
      prismaService.flagEnvironmentState.count
        .mockResolvedValueOnce(5) // total for env-1
        .mockResolvedValueOnce(3) // enabled for env-1
        .mockResolvedValueOnce(10) // total for env-2
        .mockResolvedValueOnce(7); // enabled for env-2

      const result = await service.findAllByProject('proj-123');

      expect(result).toHaveLength(2);
      expect(result[0].flagCount).toBe(5);
      expect(result[0].enabledFlagCount).toBe(3);
    });
  });

  describe('findOne', () => {
    it('should return an environment', async () => {
      prismaService.environment.findUnique.mockResolvedValue(mockEnvironment as any);

      const result = await service.findOne('env-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('env-123');
    });

    it('should throw NotFoundException if not found', async () => {
      prismaService.environment.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update an environment', async () => {
      const updateDto = { description: 'Updated description' };

      prismaService.environment.findUnique.mockResolvedValue(mockEnvironment as any);
      prismaService.environment.update.mockResolvedValue({
        ...mockEnvironment,
        ...updateDto,
      } as any);

      const result = await service.update('env-123', updateDto);

      expect(result.description).toBe('Updated description');
      expect(eventsService.emitEnvironmentUpdated).toHaveBeenCalled();
    });

    it('should check for name conflict on update', async () => {
      prismaService.environment.findUnique.mockResolvedValue(mockEnvironment as any);
      prismaService.environment.findFirst.mockResolvedValue({
        ...mockEnvironment,
        id: 'other-env',
      } as any);

      await expect(
        service.update('env-123', { name: 'production' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete an environment', async () => {
      prismaService.environment.findUnique.mockResolvedValue({
        ...mockEnvironment,
        type: 'custom',
      } as any);
      prismaService.environment.delete.mockResolvedValue(mockEnvironment as any);

      const result = await service.delete('env-123');

      expect(result).toEqual({ deleted: true, id: 'env-123' });
      expect(redisService.del).toHaveBeenCalled();
    });

    it('should throw BadRequestException for default environments', async () => {
      prismaService.environment.findUnique.mockResolvedValue({
        ...mockEnvironment,
        type: 'development',
      } as any);

      await expect(service.delete('env-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('rotateApiKey', () => {
    it('should rotate API key and return new key', async () => {
      prismaService.environment.findUnique.mockResolvedValue(mockEnvironment as any);
      prismaService.environment.update.mockResolvedValue({
        ...mockEnvironment,
        apiKeyHash: 'new-hash',
      } as any);

      const result = await service.rotateApiKey('env-123');

      expect(result.apiKey).toBeDefined();
      expect(result.apiKey).toMatch(/^ll_/); // API key prefix
      expect(redisService.del).toHaveBeenCalled();
      expect(eventsService.emitApiKeyRotated).toHaveBeenCalled();
    });
  });

  describe('validateApiKey', () => {
    it('should return environment for valid API key', async () => {
      // Mock cache miss, then DB lookup
      redisService.get.mockResolvedValue(null);
      prismaService.environment.findFirst.mockResolvedValue({
        ...mockEnvironment,
        project: { id: 'proj-123' },
      } as any);

      const result = await service.validateApiKey('ll_test_key');

      expect(result).toBeDefined();
      expect(result?.id).toBe('env-123');
    });

    it('should return cached result', async () => {
      redisService.get.mockResolvedValue(JSON.stringify({
        ...mockEnvironment,
        project: { id: 'proj-123' },
      }));

      const result = await service.validateApiKey('ll_test_key');

      expect(result).toBeDefined();
      expect(prismaService.environment.findFirst).not.toHaveBeenCalled();
    });

    it('should return null for invalid API key', async () => {
      redisService.get.mockResolvedValue(null);
      prismaService.environment.findFirst.mockResolvedValue(null);

      const result = await service.validateApiKey('invalid_key');

      expect(result).toBeNull();
    });
  });
});
