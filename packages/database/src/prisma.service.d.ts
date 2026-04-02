import { type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
declare global {
    var prisma: PrismaClient | undefined;
}
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    constructor();
    private setupLogging;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        latency: number;
        message?: string;
    }>;
    executeTransaction<T>(fn: (prisma: Prisma.TransactionClient) => Promise<T>, options?: {
        maxRetries?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
    }): Promise<T>;
    cleanDatabase(): Promise<void>;
}
//# sourceMappingURL=prisma.service.d.ts.map