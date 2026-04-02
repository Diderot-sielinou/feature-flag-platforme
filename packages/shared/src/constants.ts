// =============================================================================
// LaunchLayer - Shared Constants
// =============================================================================

export const API_VERSION = 'v1';

// =============================================================================
// CACHE KEYS (Redis)
// =============================================================================

export const CACHE_KEYS = {
  // Flag state cache
  FLAG_STATE: (projectId: string, envId: string, flagKey: string) =>
    `ff:state:${projectId}:${envId}:${flagKey}`,

  // All flags for an environment
  FLAGS_BY_ENV: (projectId: string, envId: string) => `ff:flags:${projectId}:${envId}`,

  // All flags cache (alias)
  ALL_FLAGS: (projectId: string, envId: string) => `ff:flags:${projectId}:${envId}`,

  // Project cache
  PROJECT: (projectId: string) => `ff:project:${projectId}`,

  // Environment by API key
  ENV_BY_API_KEY: (apiKeyHash: string) => `ff:env:key:${apiKeyHash}`,

  // Environment details
  ENVIRONMENT: (envId: string) => `ff:env:${envId}`,

  // Entity cache
  ENTITY: (projectId: string, entityId: string) => `ff:entity:${projectId}:${entityId}`,

  // SSE connections tracking
  SSE_CONNECTIONS: (projectId: string, envId: string) => `ff:sse:${projectId}:${envId}`,
} as const;

// =============================================================================
// REDIS CHANNELS (Pub/Sub for local development)
// =============================================================================

export const REDIS_CHANNELS = {
  FLAG_UPDATES: 'ff:channel:flag_updates',
  ENV_UPDATES: 'ff:channel:env_updates',
  CACHE_INVALIDATION: 'ff:channel:cache_invalidation',
} as const;

// =============================================================================
// AWS EVENT SOURCES (for EventBridge)
// =============================================================================

export const EVENT_SOURCES = {
  MANAGEMENT_API: 'launchlayer.management',
  READ_API: 'launchlayer.read',
  SYSTEM: 'launchlayer.system',
} as const;

// =============================================================================
// EVENT TYPES (for EventBridge detail-type)
// =============================================================================

export const EVENT_TYPES = {
  FLAG_CREATED: 'flag.created',
  FLAG_UPDATED: 'flag.updated',
  FLAG_DELETED: 'flag.deleted',
  FLAG_STATE_CHANGED: 'flag.state_changed',

  ENVIRONMENT_CREATED: 'environment.created',
  ENVIRONMENT_UPDATED: 'environment.updated',
  ENVIRONMENT_DELETED: 'environment.deleted',
  API_KEY_ROTATED: 'environment.api_key_rotated',

  ENTITY_CREATED: 'entity.created',
  ENTITY_UPDATED: 'entity.updated',
  ENTITY_DELETED: 'entity.deleted',

  MEMBER_INVITED: 'member.invited',
  MEMBER_REMOVED: 'member.removed',
} as const;

// =============================================================================
// PERFORMANCE TARGETS
// =============================================================================

export const PERFORMANCE_TARGETS = {
  // API latency targets (in milliseconds)
  READ_API_P99_MS: 50,
  READ_API_P50_MS: 10,
  MANAGEMENT_API_P99_MS: 200,

  // Cache settings
  CACHE_TTL_SECONDS: 300, // 5 minutes
  CACHE_TTL_SHORT_SECONDS: 60, // 1 minute for frequently changing data
  CACHE_TTL_LONG_SECONDS: 3600, // 1 hour for static data

  // SSE settings
  SSE_PROPAGATION_MAX_SECONDS: 5,
  SSE_HEARTBEAT_INTERVAL_SECONDS: 30,
  SSE_RECONNECT_BASE_DELAY_MS: 1000,
  SSE_RECONNECT_MAX_DELAY_MS: 30000,
} as const;

// =============================================================================
// LIMITS
// =============================================================================

export const LIMITS = {
  // Batch operations
  MAX_ENTITIES_PER_BATCH: 10000,
  MAX_FLAGS_PER_REQUEST: 100,

  // Rules limits
  MAX_RULES_SIZE_KB: 256,
  MAX_WHITELIST_SIZE: 50000,
  MAX_BLACKLIST_SIZE: 10000,
  MAX_ATTRIBUTE_RULES: 100,

  // Rate limiting
  DEFAULT_QPS_PER_API_KEY: 1000,
  BURST_QPS_PER_API_KEY: 2000,

  // SSE connections
  MAX_SSE_CONNECTIONS_PER_PROJECT: 10000,
  MAX_SSE_CONNECTIONS_PER_ENV: 5000,

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // String limits
  MAX_FLAG_KEY_LENGTH: 128,
  MAX_FLAG_NAME_LENGTH: 256,
  MAX_PROJECT_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_TAG_LENGTH: 50,
  MAX_TAGS_PER_FLAG: 20,

  // Audit log retention (days)
  AUDIT_LOG_RETENTION_DAYS: 365,
} as const;

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULTS = {
  // Default environments created with new project
  PROJECT_ENVIRONMENTS: [
    { name: 'development', type: 'DEVELOPMENT', color: '#6366F1', sortOrder: 0 },
    { name: 'staging', type: 'STAGING', color: '#F59E0B', sortOrder: 1 },
    { name: 'production', type: 'PRODUCTION', color: '#10B981', sortOrder: 2 },
  ] as const,

  // Default rule set
  RULE_SET: {
    version: 1,
    priority: ['entityList', 'attributeMatch', 'percentage', 'default'] as const,
    entityList: {
      whitelist: [],
      blacklist: [],
    },
    attributeMatch: [],
    percentage: {
      salt: '',
      rollout: 0,
    },
    default: {
      variant: 'off' as const,
    },
  },

  // Invitation expiry
  INVITATION_EXPIRY_HOURS: 72,
} as const;

// =============================================================================
// ERROR CODES
// =============================================================================

export const ERROR_CODES = {
  // Authentication errors
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Project errors
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_SLUG_EXISTS: 'PROJECT_SLUG_EXISTS',

  // Flag errors
  FLAG_NOT_FOUND: 'FLAG_NOT_FOUND',
  FLAG_KEY_EXISTS: 'FLAG_KEY_EXISTS',
  INVALID_RULES: 'INVALID_RULES',

  // Environment errors
  ENVIRONMENT_NOT_FOUND: 'ENVIRONMENT_NOT_FOUND',
  ENVIRONMENT_NAME_EXISTS: 'ENVIRONMENT_NAME_EXISTS',
  INVALID_API_KEY: 'INVALID_API_KEY',

  // Entity errors
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  ENTITY_ID_EXISTS: 'ENTITY_ID_EXISTS',

  // Member errors
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  MEMBER_ALREADY_EXISTS: 'MEMBER_ALREADY_EXISTS',
  CANNOT_REMOVE_OWNER: 'CANNOT_REMOVE_OWNER',

  // Invitation errors
  INVITATION_NOT_FOUND: 'INVITATION_NOT_FOUND',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_ALREADY_USED: 'INVITATION_ALREADY_USED',

  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
} as const;

// =============================================================================
// HTTP STATUS CODES (for reference)
// =============================================================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// =============================================================================
// ROLE PERMISSIONS
// =============================================================================

export const ROLE_PERMISSIONS = {
  OWNER: {
    canManageProject: true,
    canDeleteProject: true,
    canManageMembers: true,
    canManageEnvironments: true,
    canRotateApiKeys: true,
    canManageFlags: true,
    canViewAuditLogs: true,
    canExportData: true,
  },
  ADMIN: {
    canManageProject: true,
    canDeleteProject: false,
    canManageMembers: true,
    canManageEnvironments: true,
    canRotateApiKeys: true,
    canManageFlags: true,
    canViewAuditLogs: true,
    canExportData: true,
  },
  EDITOR: {
    canManageProject: false,
    canDeleteProject: false,
    canManageMembers: false,
    canManageEnvironments: false,
    canRotateApiKeys: false,
    canManageFlags: true,
    canViewAuditLogs: true,
    canExportData: false,
  },
  VIEWER: {
    canManageProject: false,
    canDeleteProject: false,
    canManageMembers: false,
    canManageEnvironments: false,
    canRotateApiKeys: false,
    canManageFlags: false,
    canViewAuditLogs: true,
    canExportData: false,
  },
} as const;

export type RolePermissions = (typeof ROLE_PERMISSIONS)[keyof typeof ROLE_PERMISSIONS];

// =============================================================================
// SSE MESSAGE TYPES
// =============================================================================

export enum SSEMessageType {
  BOOTSTRAP = 'bootstrap',
  FLAG_CREATED = 'flag.created',
  FLAG_UPDATED = 'flag.updated',
  FLAG_DELETED = 'flag.deleted',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error',
  RECONNECT = 'reconnect',
}
