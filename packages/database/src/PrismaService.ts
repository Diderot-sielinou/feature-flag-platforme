import { type INestApplication, Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**

* Service to manage the connection and database operations with Prisma.

* This service is designed to be a global and reusable provider in NestJS.

* It directly extends the PrismaClient, providing direct access to all client methods.

* NOTE: We use the global singleton technique to avoid multiple initializations of the PrismaClient during hot-reloading of ts-node-dev.

*/

// Using an extended type to attach the global client
declare global {
  var prisma: PrismaClient | undefined;
}

// Initializes a single global client if the environment is not in production
const prismaClient =
  global.prisma ||
  new PrismaClient({
    // Log requests, errors, and warnings for debugging
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prismaClient;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // Calls the PrismaClient constructor with the global/single instance
    super();
  }

  async onModuleInit() {
    // Ensure the client is connected during Nest module initialization
    await this.$connect();
  }

  // Optional hook for cleanly closing the connection when the application stops
  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit' as never, async () => {
      await app.close();
    });
  }

  /**

* Returns the single instance of the Prisma client for direct use if needed.

* @returns {PrismaClient} The instance of the Prisma client.

*/
  get client(): PrismaClient {
    return this as PrismaClient;
  }
}
