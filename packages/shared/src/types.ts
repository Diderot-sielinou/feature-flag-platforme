// =============================================================================
// LaunchLayer - Shared Types
// =============================================================================

// =============================================================================
// ENUMS
// =============================================================================

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  DELETED = 'DELETED',
}

export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export enum BillingPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum EnvironmentType {
  DEVELOPMENT = 'DEVELOPMENT',
  STAGING = 'STAGING',
  QA = 'QA',
  PRODUCTION = 'PRODUCTION',
  CUSTOM = 'CUSTOM',
}

export enum EntityType {
  USER = 'USER',
  ORGANIZATION = 'ORGANIZATION',
  DEVICE = 'DEVICE',
  SERVICE = 'SERVICE',
  CUSTOM = 'CUSTOM',
}

export enum ProjectRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum ApiKeyScope {
  READ_ONLY = 'READ_ONLY',
  WRITE = 'WRITE',
  ADMIN = 'ADMIN',
}

export enum FlagType {
  BOOLEAN = 'BOOLEAN',
  MULTIVARIATE = 'MULTIVARIATE',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  JSON = 'JSON',
}

export enum FlagLifecycle {
  PERMANENT = 'PERMANENT',
  TEMPORARY = 'TEMPORARY',
  EXPERIMENT = 'EXPERIMENT',
  KILL_SWITCH = 'KILL_SWITCH',
  OPERATIONAL = 'OPERATIONAL',
}

export enum FlagStatus {
  ACTIVE = 'ACTIVE',
  DEPRECATED = 'DEPRECATED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export enum CacheStrategy {
  NO_CACHE = 'NO_CACHE',
  STANDARD = 'STANDARD',
  AGGRESSIVE = 'AGGRESSIVE',
  EDGE = 'EDGE',
}

export enum SnapshotType {
  MANUAL = 'MANUAL',
  AUTO = 'AUTO',
  SCHEDULED = 'SCHEDULED',
  PRE_DEPLOY = 'PRE_DEPLOY',
}

export enum ScheduleAction {
  ENABLE = 'ENABLE',
  DISABLE = 'DISABLE',
  UPDATE_RULES = 'UPDATE_RULES',
  DELETE = 'DELETE',
}

export enum ScheduleStatus {
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum RuleOperator {
  EQ = 'EQ', // Equal
  NEQ = 'NEQ', // Not equal
  IN = 'IN', // In list
  NOT_IN = 'NOT_IN', // Not in list
  GT = 'GT', // Greater than
  GTE = 'GTE', // Greater than or equal
  LT = 'LT', // Less than
  LTE = 'LTE', // Less than or equal
  CONTAINS = 'CONTAINS', // String contains
  NOT_CONTAINS = 'NOT_CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  REGEX = 'REGEX', // Regex match
  EXISTS = 'EXISTS', // Attribute exists
  NOT_EXISTS = 'NOT_EXISTS',
}

export enum EvaluationSource {
  DEFAULT = 'default',
  WHITELIST = 'whitelist',
  BLACKLIST = 'blacklist',
  ATTRIBUTE = 'attribute',
  PERCENTAGE = 'percentage',
  SEGMENT = 'segment',
  NOT_FOUND = 'not_found',
}

export enum ActorType {
  USER = 'USER',
  API_KEY = 'API_KEY',
  SYSTEM = 'SYSTEM',
  WEBHOOK = 'WEBHOOK',
  SCHEDULED = 'SCHEDULED',
}

export enum AuditCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  PROJECT_CHANGE = 'PROJECT_CHANGE',
  FLAG_CHANGE = 'FLAG_CHANGE',
  ENVIRONMENT_CHANGE = 'ENVIRONMENT_CHANGE',
  ENTITY_CHANGE = 'ENTITY_CHANGE',
  API_KEY_CHANGE = 'API_KEY_CHANGE',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  CONFIGURATION = 'CONFIGURATION',
  SECURITY = 'SECURITY',
}

export enum AuditSource {
  WEB = 'WEB',
  API = 'API',
  SDK = 'SDK',
  CLI = 'CLI',
  MOBILE = 'MOBILE',
  SYSTEM = 'SYSTEM',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
}

export enum AuditSeverity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  NOTICE = 'NOTICE',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
  ALERT = 'ALERT',
}

export enum WebhookEvent {
  FLAG_CREATED = 'FLAG_CREATED',
  FLAG_UPDATED = 'FLAG_UPDATED',
  FLAG_DELETED = 'FLAG_DELETED',
  FLAG_TOGGLED = 'FLAG_TOGGLED',
  ENVIRONMENT_CREATED = 'ENVIRONMENT_CREATED',
  PROJECT_CREATED = 'PROJECT_CREATED',
  SEGMENT_CREATED = 'SEGMENT_CREATED',
}

export enum WebhookStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
}

// =============================================================================
// BASE INTERFACES
// =============================================================================

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// USER TYPES (Table 1)
// =============================================================================

export interface User extends Timestamps {
  id: string;
  cognitoId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  timezone?: string;
  locale?: string;
  emailVerified: boolean;
  lastLoginAt?: Date;
  loginCount: number;
  status: UserStatus;
  preferences?: Record<string, unknown>;
  deletedAt?: Date;
}

export interface UserProfile extends User {
  ownedProjects: ProjectSummary[];
  memberProjects: ProjectMembership[];
}

// =============================================================================
// PROJECT TYPES (Table 2)
// =============================================================================

export interface Project extends Timestamps {
  id: string;
  name: string;
  key: string;
  description?: string;
  icon?: string;
  color?: string;
  tags: string[];
  ownerId: string;
  status: ProjectStatus;
  archivedAt?: Date;
  maxFlags?: number;
  currentFlagCount: number;
  billingPlan: BillingPlan;
  settings?: Record<string, unknown>;
  deletedAt?: Date;
}

export interface ProjectSummary {
  id: string;
  name: string;
  key: string;
  role: ProjectRole;
  flagCount?: number;
  environmentCount?: number;
}

export interface ProjectWithDetails extends Project {
  owner: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
  environments: Environment[];
  flags: Flag[];
  memberCount: number;
}

// =============================================================================
// PROJECT MEMBER TYPES (Table 3)
// =============================================================================

export interface ProjectMember extends Timestamps {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  invitedBy?: string;
  invitedAt: Date;
  acceptedAt?: Date;
  user?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'avatar'>;
}

export interface ProjectMembership {
  projectId: string;
  projectName: string;
  projectKey: string;
  role: ProjectRole;
}

// =============================================================================
// INVITATION TYPES
// =============================================================================

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface Invitation {
  id: string;
  projectId: string;
  email: string;
  role: ProjectRole;
  token: string;
  status: InvitationStatus;
  senderId: string;
  expiresAt: Date;
  createdAt: Date;
}

// =============================================================================
// ENVIRONMENT TYPES (Table 4)
// =============================================================================

export interface Environment extends Timestamps {
  id: string;
  projectId: string;
  name: string;
  key: string;
  type: EnvironmentType;
  description?: string;
  color?: string;
  baseUrl?: string;
  requireApproval: boolean;
  protected: boolean;
  sortOrder: number;
  active: boolean;
}

export interface EnvironmentWithStats extends Environment {
  flagCount: number;
  enabledFlagCount: number;
}

// =============================================================================
// API KEY TYPES (Table 5)
// =============================================================================

export interface ApiKey extends Timestamps {
  id: string;
  projectId: string;
  envId?: string;
  key: string;
  keyHash: string;
  name: string;
  description?: string;
  scope: ApiKeyScope;
  rateLimit?: number;
  lastUsedAt?: Date;
  usageCount: number;
  ipWhitelist: string[];
  expiresAt?: Date;
  rotatedFrom?: string;
  rotatedAt?: Date;
  active: boolean;
  revokedAt?: Date;
  revokedBy?: string;
  createdBy: string;
}

export interface ApiKeyWithEnvironment extends ApiKey {
  environment?: Pick<Environment, 'id' | 'name' | 'type'>;
}

// =============================================================================
// FLAG TYPES (Table 6)
// =============================================================================

export interface Flag extends Timestamps {
  id: string;
  projectId: string;
  name: string;
  key: string;
  type: FlagType;
  title?: string;
  description?: string;
  tags: string[];
  category?: string;
  ownerId?: string;
  lifecycle: FlagLifecycle;
  status: FlagStatus;
  expiresAt?: Date;
  temporary: boolean;
  maintainer?: string;
  jiraTicket?: string;
  docsUrl?: string;
  deletedAt?: Date;
}

export interface FlagWithStates extends Flag {
  states: FlagEnvironmentState[];
  variants?: FlagVariant[];
}

// =============================================================================
// FLAG ENVIRONMENT STATE TYPES (Table 7)
// =============================================================================

export interface FlagEnvironmentState extends Timestamps {
  id: string;
  flagId: string;
  envId: string;
  defaultState: boolean;
  rules: RuleSet;
  rulesHash?: string;
  version: number;
  offVariation?: string;
  fallbackValue: boolean;
  rolloutPercentage?: number;
  evaluationCount: number;
  lastEvaluatedAt?: Date;
  avgEvaluationMs?: number;
  cacheStrategy: CacheStrategy;
  cacheTTL?: number;
  enabled: boolean;
  lastModifiedBy?: string;
}

export interface FlagStateWithEnvironment extends FlagEnvironmentState {
  environment: Pick<Environment, 'id' | 'name' | 'type' | 'color'>;
}

// =============================================================================
// FLAG STATE SNAPSHOT TYPES (Table 8)
// =============================================================================

export interface FlagStateSnapshot {
  id: string;
  stateId: string;
  version: number;
  defaultState: boolean;
  rules: RuleSet;
  snapshotType: SnapshotType;
  createdBy: string;
  reason?: string;
  label?: string;
  createdAt: Date;
}

// =============================================================================
// FLAG VARIANT TYPES (Table 9)
// =============================================================================

export interface FlagVariant extends Timestamps {
  id: string;
  flagId: string;
  key: string;
  name: string;
  description?: string;
  value: unknown;
  weight: number;
  active: boolean;
  sortOrder: number;
}

// =============================================================================
// RULES TYPES
// =============================================================================

export interface RuleSet {
  version: number;
  priority: RulePriority[];
  entityList?: EntityListRule;
  attributeMatch?: AttributeMatchRule[];
  percentage?: PercentageRule;
  default?: DefaultRule;
}

export type RulePriority = 'entityList' | 'attributeMatch' | 'percentage' | 'default';

export interface EntityListRule {
  whitelist: string[];
  blacklist: string[];
}

export interface AttributeMatchRule {
  id: string;
  name?: string;
  conditions: AttributeCondition[];
  matchType: 'ALL' | 'ANY';
  enabled: boolean;
  variant?: string;
}

export interface AttributeCondition {
  attribute: string;
  operator: RuleOperator;
  value?: unknown;
  values?: unknown[];
}

export interface PercentageRule {
  salt: string;
  rollout: number; // 0-100
  stickiness?: string; // Attribute to use for consistent hashing
}

export interface DefaultRule {
  variant: 'on' | 'off';
}

// =============================================================================
// SEGMENT TYPES (Table 10)
// =============================================================================

export interface Segment extends Timestamps {
  id: string;
  projectId: string;
  key: string;
  name: string;
  description?: string;
  rules: RuleSet;
  color?: string;
  icon?: string;
  active: boolean;
  createdBy: string;
}

export interface SegmentWithUsage extends Segment {
  flagCount: number;
}

// =============================================================================
// FLAG SEGMENT TYPES (Table 11)
// =============================================================================

export interface FlagSegment {
  id: string;
  stateId: string;
  segmentId: string;
  variation?: string;
  priority: number;
  createdAt: Date;
}

export interface FlagSegmentWithDetails extends FlagSegment {
  segment: Pick<Segment, 'id' | 'key' | 'name' | 'color'>;
}

// =============================================================================
// FLAG SCHEDULE TYPES (Table 12)
// =============================================================================

export interface FlagSchedule extends Timestamps {
  id: string;
  flagId: string;
  envId: string;
  action: ScheduleAction;
  targetState: Record<string, unknown>;
  scheduledAt: Date;
  executedAt?: Date;
  createdBy: string;
  reason?: string;
  status: ScheduleStatus;
  errorMessage?: string;
}

export interface FlagScheduleWithDetails extends FlagSchedule {
  flag: Pick<Flag, 'id' | 'key' | 'name'>;
  environment: Pick<Environment, 'id' | 'name' | 'type'>;
}

// =============================================================================
// ENTITY TYPES (Table 13)
// =============================================================================

export interface Entity extends Timestamps {
  id: string;
  projectId: string;
  type: EntityType;
  attributes: Record<string, unknown>;
  email?: string;
  name?: string;
  country?: string;
  plan?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  seenCount: number;
  segmentKeys: string[];
  active: boolean;
}

export interface EntityWithSegments extends Entity {
  segments: Pick<Segment, 'id' | 'key' | 'name' | 'color'>[];
}

// =============================================================================
// EVALUATION TYPES
// =============================================================================

export interface EvaluationContext {
  entityId: string;
  entityType?: EntityType;
  attributes?: Record<string, unknown>;
}

export interface EvaluationRequest {
  flagKey: string;
  context: EvaluationContext;
}

export interface EvaluationResponse {
  flagKey: string;
  enabled: boolean;
  source: EvaluationSource;
  ruleId?: string;
  variant?: string;
  version: number;
}

export interface BulkEvaluationRequest {
  flagKeys: string[];
  context: EvaluationContext;
}

export interface BulkEvaluationResponse {
  flags: Record<string, EvaluationResponse>;
  evaluatedAt: string;
}

// =============================================================================
// SSE TYPES
// =============================================================================

export enum SSEEventType {
  FLAG_UPDATED = 'flag_updated',
  FLAG_CREATED = 'flag_created',
  FLAG_DELETED = 'flag_deleted',
  FLAG_STATE_CHANGED = 'flag_state_changed',
  ENVIRONMENT_UPDATED = 'environment_updated',
  CONNECTION_ESTABLISHED = 'connection_established',
  HEARTBEAT = 'heartbeat',
}

export interface SSEMessage {
  type: SSEEventType;
  projectId: string;
  envId?: string;
  flagId?: string;
  flagKey?: string;
  version?: number;
  timestamp: string;
  data?: Record<string, unknown>;
}

// =============================================================================
// AUDIT LOG TYPES (Table 14)
// =============================================================================

export interface AuditLog {
  id: string;
  projectId: string;
  actorId: string;
  actorType: ActorType;
  action: string;
  category: AuditCategory;
  targetType: string;
  targetId: string;
  targetName?: string;
  envId?: string;
  envName?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  diff?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  requestId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  source: AuditSource;
  method?: string;
  path?: string;
  status: AuditStatus;
  errorMessage?: string;
  severity: AuditSeverity;
  reason?: string;
  durationMs?: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface AuditLogWithActor extends AuditLog {
  actor: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
}

// =============================================================================
// WEBHOOK TYPES (Table 15)
// =============================================================================

export interface Webhook extends Timestamps {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  headers?: Record<string, string>;
  retryEnabled: boolean;
  maxRetries: number;
  timeout: number;
  active: boolean;
  lastTriggeredAt?: Date;
  lastStatus?: WebhookStatus;
  failureCount: number;
  createdBy: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  status: WebhookStatus;
  responseCode?: number;
  responseBody?: string;
  errorMessage?: string;
  attempts: number;
  createdAt: Date;
  completedAt?: Date;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =============================================================================
// EVENT TYPES (for EventBridge/SNS)
// =============================================================================

export interface FlagEvent {
  eventType: 'flag.created' | 'flag.updated' | 'flag.deleted' | 'flag.state_changed';
  projectId: string;
  envId: string;
  flagId: string;
  flagKey: string;
  version: number;
  timestamp: string;
  actor?: {
    id: string;
    type: 'user' | 'system';
  };
  payload?: Record<string, unknown>;
}

// =============================================================================
// SIMULATION TYPES
// =============================================================================

export interface SimulationRequest {
  flagKey: string;
  envId: string;
  context: EvaluationContext;
  rules?: RuleSet; // Optional: test with custom rules before saving
}

export interface SimulationResponse {
  result: EvaluationResponse;
  matchedRule?: {
    type: RulePriority;
    ruleId?: string;
    condition?: AttributeCondition;
  };
  evaluationPath: string[];
}
