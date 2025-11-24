import { type INestApplication, Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Service pour gérer la connexion et les opérations de base de données avec Prisma.
 * Ce service est conçu pour être un fournisseur global et réutilisable dans NestJS.
 * Il étend le PrismaClient directement, offrant un accès direct à toutes les méthodes du client.
 *
 * NOTE: Nous utilisons la technique du singleton global pour éviter l'initialisation
 * multiple du PrismaClient lors du hot-reloading de ts-node-dev.
 */

// Utilisation d'un type étendu pour attacher le client global
declare global {
  var prisma: PrismaClient | undefined;
}

// Initialise un client global unique si l'environnement n'est pas de production
const prismaClient =
  global.prisma ||
  new PrismaClient({
    // Log les requêtes, erreurs et avertissements pour le débogage
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prismaClient;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // Appelle le constructeur de PrismaClient avec l'instance globale/unique
    super();
  }

  async onModuleInit() {
    // S'assurer que le client est connecté lors de l'initialisation du module Nest
    await this.$connect();
  }

  // Hook optionnel pour la fermeture propre de la connexion lors de l'arrêt de l'application
  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit' as never, async () => {
      await app.close();
    });
  }

  /**
   * Retourne l'instance unique du client Prisma pour un usage direct si nécessaire.
   * @returns {PrismaClient} L'instance du client Prisma.
   */
  get client(): PrismaClient {
    return this as PrismaClient;
  }
}
