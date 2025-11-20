export const API_VERSION = 'v1';

export const CACHE_KEYS = {
  FLAG_STATE: (projectId: string, envId: string, flagName: string) =>
    `ff:flag:${projectId}:${envId}:${flagName}`,
  FLAG_LIST: (projectId: string, envId: string) => `ff:flags:${projectId}:${envId}`,
  PROJECT: (projectId: string) => `ff:project:${projectId}`,
  ENVIRONMENT: (envId: string) => `ff:env:${envId}`,
} as const;

export const REDIS_CHANNELS = {
  FLAG_UPDATES: 'flag:updates',
  ENV_UPDATES: 'env:updates',
} as const;

export const PERFORMANCE_TARGETS = {
  READ_API_P99_MS: 50,
  READ_API_P50_MS: 10,
  CACHE_TTL_SECONDS: 300,
  SSE_PROPAGATION_MAX_SECONDS: 5,
} as const;

export const LIMITS = {
  MAX_ENTITIES_PER_BATCH: 10000,
  MAX_RULES_SIZE_KB: 256,
  DEFAULT_QPS_PER_API_KEY: 1000,
  MAX_SSE_CONNECTIONS_PER_PROJECT: 10000,
} as const;

/**
 * export const API_VERSION = 'v1';

// Clés pour le cache Redis (toujours utiles pour SDK)
export const CACHE_KEYS = {
  FLAG_STATE: (projectId: string, envId: string, flagName: string) =>
    `ff:flag:${projectId}:${envId}:${flagName}`,
  FLAG_LIST: (projectId: string, envId: string) =>
    `ff:flags:${projectId}:${envId}`,
  PROJECT: (projectId: string) => `ff:project:${projectId}`,
  ENVIRONMENT: (envId: string) => `ff:env:${envId}`,
} as const;

// Channels/Topics pour communication cross-service via EventBridge + SNS/SQS
export const EVENT_CHANNELS = {
  FLAG_UPDATES: 'FlagUpdatesTopic',  // Nom ou ARN du SNS Topic
  ENV_UPDATES: 'EnvUpdatesTopic',    // Nom ou ARN du SNS Topic
} as const;

// Objectifs de performance
export const PERFORMANCE_TARGETS = {
  READ_API_P99_MS: 50,
  READ_API_P50_MS: 10,
  CACHE_TTL_SECONDS: 300,
  SSE_PROPAGATION_MAX_SECONDS: 5,
} as const;

// Limites générales
export const LIMITS = {
  MAX_ENTITIES_PER_BATCH: 10000,
  MAX_RULES_SIZE_KB: 256,
  DEFAULT_QPS_PER_API_KEY: 1000,
  MAX_SSE_CONNECTIONS_PER_PROJECT: 10000,
} as const;

 */
