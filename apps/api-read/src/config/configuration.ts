/* eslint-disable turbo/no-undeclared-env-vars */
// Configuration aligned with the ECS variables in compute-stack.ts
//
// In production, these variables are injected by ECS:
// - REDIS_HOST, REDIS_PORT → ElastiCache
// - READ_QUEUE_URL → SQS to receive invalidations
// - DATABASE_URL → RDS (read-only for fallback)

export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  // ==========================================================================
  // DATABASE (lecture seule - fallback si cache miss)
  // Variables ECS: DATABASE_URL ou DB_HOST/DB_PORT/DB_NAME/DB_USERNAME/DB_PASSWORD
  // ==========================================================================
  database: {
    url: process.env.DATABASE_URL || buildDatabaseUrl(),
  },

  // ==========================================================================
  // REDIS (ElastiCache en production)
  // Variables ECS: REDIS_HOST, REDIS_PORT
  // ==========================================================================
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.NODE_ENV === 'production',
  },

  // ==========================================================================
  // MESSAGING (SQS en production, Redis en dev)
  // Variables ECS: READ_QUEUE_URL
  // ==========================================================================
  messaging: {
    // SQS queue pour recevoir les événements de api-management (production)
    readQueueUrl: process.env.READ_QUEUE_URL,
    // Polling interval pour SQS (ms)
    sqsPollingInterval: parseInt(
      process.env.SQS_POLLING_INTERVAL || '1000',
      10,
    ),
  },

  // ==========================================================================
  // AWS
  // Variable ECS: AWS_REGION
  // ==========================================================================
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
  },

  // ==========================================================================
  // CACHE
  // ==========================================================================
  cache: {
    // TTL par défaut (5 minutes)
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10),
    // Taille max du cache local (LRU)
    maxLocalItems: parseInt(process.env.CACHE_MAX_ITEMS || '10000', 10),
    // TTL du cache local (5 secondes - très court pour cohérence)
    localTtlMs: parseInt(process.env.LOCAL_CACHE_TTL_MS || '5000', 10),
  },

  // ==========================================================================
  // SSE (Server-Sent Events)
  // ==========================================================================
  sse: {
    // Intervalle heartbeat (30 secondes)
    heartbeatIntervalMs: parseInt(process.env.SSE_HEARTBEAT_MS || '30000', 10),
    // Max connexions par projet
    maxConnectionsPerProject: parseInt(
      process.env.SSE_MAX_CONNECTIONS || '10000',
      10,
    ),
  },

  // ==========================================================================
  // PERFORMANCE MONITORING
  // ==========================================================================
  performance: {
    // Cible latence P99
    targetLatencyP99Ms: 50,
    // Seuil pour logger les requêtes lentes
    slowQueryThresholdMs: parseInt(
      process.env.SLOW_QUERY_THRESHOLD_MS || '20',
      10,
    ),
  },
});

/**
 * Construit DATABASE_URL à partir des variables individuelles
 * Utilisé quand DATABASE_URL n'est pas fourni directement
 */
function buildDatabaseUrl(): string {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME || 'featureflags';
  const user = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';

  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

// Types pour ConfigService
export interface AppConfig {
  nodeEnv: string;
  port: number;
  database: { url: string };
  redis: { host: string; port: number; password?: string; tls: boolean };
  messaging: { readQueueUrl?: string; sqsPollingInterval: number };
  aws: { region: string };
  cache: { ttlSeconds: number; maxLocalItems: number; localTtlMs: number };
  sse: { heartbeatIntervalMs: number; maxConnectionsPerProject: number };
  performance: { targetLatencyP99Ms: number; slowQueryThresholdMs: number };
}
