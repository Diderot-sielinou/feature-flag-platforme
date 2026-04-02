// ========================================
// USER & AUTH TYPES
// ========================================
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
}

export type AuthAction = 'login' | 'register' | 'logout' | 'verify' | 'forgot-password';

// ========================================
// PROJECT TYPES
// ========================================
export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  owner?: User;
  environments?: Environment[];
  members?: ProjectMember[];
  _count?: {
    flags: number;
    environments: number;
    members: number;
  };
}

export interface CreateProjectDto {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
}

// ========================================
// ENVIRONMENT TYPES
// ========================================
export interface Environment {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  projectId: string;
  isDefault: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type EnvironmentSlug = 'development' | 'staging' | 'production' | string;

export interface CreateEnvironmentDto {
  name: string;
  slug?: string;
  description?: string;
  color?: string;
}

// ========================================
// FLAG TYPES
// ========================================
export type FlagType = 'BOOLEAN' | 'STRING' | 'NUMBER' | 'JSON';

export interface Flag {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: FlagType;
  defaultValue: unknown;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  tags?: string[];
  states?: FlagEnvironmentState[];
  variants?: FlagVariant[];
  segments?: FlagSegment[];
  schedules?: FlagSchedule[];
}

export interface FlagEnvironmentState {
  id: string;
  flagId: string;
  environmentId: string;
  environment?: Environment;
  enabled: boolean;
  value: unknown;
  rules?: TargetingRule[];
  rolloutPercentage: number;
  updatedAt: string;
  updatedById?: string;
}

export interface FlagVariant {
  id: string;
  key: string;
  name: string;
  value: unknown;
  weight: number;
  flagId: string;
}

export interface TargetingRule {
  id: string;
  attribute: string;
  operator: RuleOperator;
  value: string | string[] | number | boolean;
  segmentId?: string;
}

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches_regex'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'is_true'
  | 'is_false';

export interface CreateFlagDto {
  key: string;
  name: string;
  description?: string;
  type: FlagType;
  defaultValue?: unknown;
  tags?: string[];
}

export interface UpdateFlagDto {
  name?: string;
  description?: string;
  tags?: string[];
}

export interface ToggleFlagDto {
  environmentId: string;
  enabled: boolean;
}

// ========================================
// SEGMENT TYPES
// ========================================
export interface Segment {
  id: string;
  name: string;
  key: string;
  description?: string;
  projectId: string;
  rules: SegmentRule[];
  matchType: 'ALL' | 'ANY';
  createdAt: string;
  updatedAt: string;
  _count?: {
    flags: number;
  };
}

export interface SegmentRule {
  attribute: string;
  operator: RuleOperator;
  value: string | string[] | number | boolean;
}

export interface FlagSegment {
  id: string;
  flagId: string;
  segmentId: string;
  segment: Segment;
  value: unknown;
  priority: number;
}

export interface CreateSegmentDto {
  name: string;
  key?: string;
  description?: string;
  rules: SegmentRule[];
  matchType?: 'ALL' | 'ANY';
}

// ========================================
// SCHEDULE TYPES
// ========================================
export type ScheduleAction = 'ENABLE' | 'DISABLE' | 'UPDATE_VALUE' | 'UPDATE_RULES';

export interface FlagSchedule {
  id: string;
  flagId: string;
  environmentId: string;
  environment?: Environment;
  action: ScheduleAction;
  scheduledAt: string;
  executedAt?: string;
  value?: unknown;
  rules?: TargetingRule[];
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'FAILED';
  createdAt: string;
  createdById: string;
}

export interface CreateScheduleDto {
  environmentId: string;
  action: ScheduleAction;
  scheduledAt: string;
  value?: unknown;
  rules?: TargetingRule[];
}

// ========================================
// API KEY TYPES
// ========================================
export type ApiKeyType = 'SERVER' | 'CLIENT';
export type ApiKeyPermission = 'READ' | 'WRITE' | 'ADMIN';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  type: ApiKeyType;
  permissions: ApiKeyPermission[];
  projectId: string;
  environmentId?: string;
  environment?: Environment;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  createdById: string;
  isActive: boolean;
}

export interface CreateApiKeyDto {
  name: string;
  type: ApiKeyType;
  permissions: ApiKeyPermission[];
  environmentId?: string;
  expiresAt?: string;
}

// ========================================
// MEMBER TYPES
// ========================================
export type MemberRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
export type MemberStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE';

export interface ProjectMember {
  id: string;
  userId?: string;
  user?: User;
  projectId: string;
  role: MemberRole;
  status: MemberStatus;
  email: string;
  invitedById?: string;
  invitedBy?: User;
  invitedAt: string;
  joinedAt?: string;
}

export interface InviteMemberDto {
  email: string;
  role: MemberRole;
}

export interface UpdateMemberDto {
  role?: MemberRole;
}

// ========================================
// AUDIT LOG TYPES
// ========================================
export type AuditAction =
  | 'flag.created'
  | 'flag.updated'
  | 'flag.deleted'
  | 'flag.toggled'
  | 'flag.rules_updated'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'member.invited'
  | 'member.removed'
  | 'member.role_changed'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'segment.created'
  | 'segment.updated'
  | 'segment.deleted'
  | 'schedule.created'
  | 'schedule.cancelled';

export interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: 'flag' | 'project' | 'member' | 'api_key' | 'segment' | 'schedule';
  entityId: string;
  entityName?: string;
  projectId: string;
  userId: string;
  user?: User;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ========================================
// ANALYTICS TYPES
// ========================================
export interface FlagEvaluation {
  flagKey: string;
  environmentId: string;
  value: unknown;
  timestamp: string;
  entityId?: string;
  entityContext?: Record<string, unknown>;
}

export interface AnalyticsSummary {
  totalEvaluations: number;
  uniqueEntities: number;
  trueCount: number;
  falseCount: number;
  evaluationsByDay: {
    date: string;
    count: number;
  }[];
}

// ========================================
// PAGINATION & FILTERING
// ========================================
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FilterParams {
  search?: string;
  status?: string;
  type?: string;
  environmentId?: string;
  tags?: string[];
}

// ========================================
// API RESPONSE TYPES
// ========================================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// ========================================
// NOTIFICATION TYPES
// ========================================
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ========================================
// DASHBOARD STATS
// ========================================
export interface DashboardStats {
  totalProjects: number;
  totalFlags: number;
  totalEvaluations: number;
  activeFlags: number;
  recentActivity: AuditLog[];
  flagsByEnvironment: {
    environment: string;
    enabled: number;
    disabled: number;
  }[];
}

// ========================================
// FORM TYPES
// ========================================
export interface FormFieldProps {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
}

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

// ========================================
// TABLE TYPES
// ========================================
export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

export interface TableAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T) => void;
  variant?: 'default' | 'destructive';
  disabled?: (row: T) => boolean;
}
