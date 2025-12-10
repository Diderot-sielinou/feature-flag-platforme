"use strict";
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PrismaService = PrismaService_1 = class PrismaService extends client_1.PrismaClient {
    constructor() {
        const logLevels = process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'];
        super({
            log: logLevels.map((level) => ({
                emit: 'event',
                level,
            })),
            errorFormat: 'pretty',
        });
        this.logger = new common_1.Logger(PrismaService_1.name);
        if (process.env.NODE_ENV !== 'production') {
            if (!global.prisma) {
                global.prisma = this;
            }
        }
        this.setupLogging();
    }
    setupLogging() {
        if (process.env.NODE_ENV === 'development') {
            this.$on('query', (e) => {
                if (e.duration > 100) {
                    this.logger.warn(`🐌 Slow query (${e.duration}ms): ${e.query}`);
                }
                else {
                    this.logger.debug(`Query (${e.duration}ms): ${e.query.substring(0, 100)}...`);
                }
            });
        }
        this.$on('error', (e) => {
            this.logger.error(`Database error: ${e.message}`);
        });
        this.$on('warn', (e) => {
            this.logger.warn(`Database warning: ${e.message}`);
        });
    }
    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.log('✅ Successfully connected to PostgreSQL database');
        }
        catch (error) {
            this.logger.error('❌ Failed to connect to database', error);
            throw error;
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Disconnected from database');
    }
    async healthCheck() {
        const start = Date.now();
        try {
            await this.$queryRaw `SELECT 1`;
            return {
                status: 'healthy',
                latency: Date.now() - start,
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                latency: Date.now() - start,
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async executeTransaction(fn, options) {
        const { maxRetries = 3, isolationLevel } = options || {};
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.$transaction(fn, {
                    isolationLevel,
                    timeout: 10000,
                });
            }
            catch (error) {
                lastError = error;
                const isRetryable = error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                    ['P2034', 'P2028'].includes(error.code);
                if (!isRetryable || attempt === maxRetries) {
                    throw error;
                }
                this.logger.warn(`Transaction failed (attempt ${attempt}/${maxRetries}), retrying...`);
                await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
            }
        }
        throw lastError;
    }
    async cleanDatabase() {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('❌ Cannot clean database in production!');
        }
        const tablenames = await this.$queryRaw `
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;
        for (const { tablename } of tablenames) {
            if (tablename !== '_prisma_migrations') {
                try {
                    await this.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
                }
                catch (error) {
                    this.logger.warn(`Could not truncate ${tablename}`);
                }
            }
        }
        this.logger.log('🧹 Database cleaned successfully');
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map