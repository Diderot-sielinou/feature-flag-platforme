// // import { UnauthorizedException } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { Test, type TestingModule } from '@nestjs/testing';

// import { PrismaService } from '../database/prisma.service';

// import { AuthService } from './auth.service';

// describe('AuthService', () => {
//   let service: AuthService;
//   let prismaService: jest.Mocked<PrismaService>;
//   // let configService: jest.Mocked<ConfigService>;

//   const mockUser = {
//     id: 'user-123',
//     email: 'test@example.com',
//     externalId: 'clerk-123',
//     name: 'Test User',
//     createdAt: new Date(),
//     updatedAt: new Date(),
//   };

//   const mockCognitoPayload = {
//     sub: 'clerk-123',
//     email: 'test@example.com',
//     email_verified: true,
//     name: 'Test User',
//   };

//   beforeEach(async () => {
//     const mockPrismaService = {
//       user: {
//         findUnique: jest.fn(),
//         upsert: jest.fn(),
//         update: jest.fn(),
//       },
//     };

//     const mockConfigService = {
//       get: jest.fn((key: string) => {
//         const config: Record<string, string> = {
//           'clerk.userPoolId': 'us-east-1_testpool',
//           'clerk.clientId': 'test-client-id',
//           'clerk.region': 'us-east-1',
//           'clerk.issuer': 'https://clerk-idp.us-east-1.amazonaws.com/us-east-1_testpool',
//         };
//         return config[key];
//       }),
//     };

//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         AuthService,
//         { provide: PrismaService, useValue: mockPrismaService },
//         { provide: ConfigService, useValue: mockConfigService },
//       ],
//     }).compile();

//     service = module.get<AuthService>(AuthService);
//     prismaService = module.get(PrismaService);
//     configService = module.get(ConfigService);
//   });

//   it('should be defined', () => {
//     expect(service).toBeDefined();
//   });

//   describe('validateCognitoUser', () => {
//     it('should return existing user', async () => {
//       prismaService.user.findUnique.mockResolvedValue(mockUser as any);

//       const result = await service.validateCognitoUser(mockCognitoPayload);

//       expect(result).toEqual(mockUser);
//       expect(prismaService.user.findUnique).toHaveBeenCalledWith({
//         where: { externalId: mockCognitoPayload.sub },
//       });
//     });

//     it('should create new user if not exists', async () => {
//       prismaService.user.findUnique.mockResolvedValue(null);
//       prismaService.user.upsert.mockResolvedValue(mockUser as any);

//       const result = await service.validateCognitoUser(mockCognitoPayload);

//       expect(result).toEqual(mockUser);
//       expect(prismaService.user.upsert).toHaveBeenCalled();
//     });

//     it('should update user name if changed', async () => {
//       const existingUser = { ...mockUser, name: 'Old Name' };
//       prismaService.user.findUnique.mockResolvedValue(existingUser as any);
//       prismaService.user.update.mockResolvedValue({
//         ...existingUser,
//         name: mockCognitoPayload.name,
//       } as any);

//       const result = await service.validateCognitoUser(mockCognitoPayload);

//       expect(prismaService.user.update).toHaveBeenCalledWith({
//         where: { id: existingUser.id },
//         data: { name: mockCognitoPayload.name },
//       });
//     });
//   });

//   describe('getUserById', () => {
//     it('should return user by id', async () => {
//       prismaService.user.findUnique.mockResolvedValue(mockUser as any);

//       const result = await service.getUserById(mockUser.id);

//       expect(result).toEqual(mockUser);
//     });

//     it('should return null for non-existent user', async () => {
//       prismaService.user.findUnique.mockResolvedValue(null);

//       const result = await service.getUserById('non-existent');

//       expect(result).toBeNull();
//     });
//   });

//   describe('getUserByEmail', () => {
//     it('should return user by email', async () => {
//       prismaService.user.findUnique.mockResolvedValue(mockUser as any);

//       const result = await service.getUserByEmail(mockUser.email);

//       expect(result).toEqual(mockUser);
//     });
//   });

//   describe('getUserByCognitoId', () => {
//     it('should return user by clerk id', async () => {
//       prismaService.user.findUnique.mockResolvedValue(mockUser as any);

//       const result = await service.getUserByCognitoId(mockUser.externalId);

//       expect(result).toEqual(mockUser);
//     });
//   });
// });
