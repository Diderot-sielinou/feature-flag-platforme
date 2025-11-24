/* eslint-disable @typescript-eslint/no-explicit-any */

// Types partagés entre tous les services

export enum EnvironmentType {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export enum EntityType {
  USER = 'user',
  ORGANIZATION = 'org',
}

export enum RuleOperator {
  EQ = 'EQ',
  IN = 'IN',
  GT = 'GT',
  LT = 'LT',
  GTE = 'GTE',
  LTE = 'LTE',
  PREFIX = 'PREFIX',
}

// Interfaces principales
export interface Project {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Environment {
  id: string;
  projectId: string;
  name: EnvironmentType;
  apiKey: string;
  active: boolean;
  createdAt: Date;
}

export interface Flag {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FlagEnvironmentState {
  id: string;
  flagId: string;
  envId: string;
  defaultState: boolean;
  rules: RuleSet;
  version: number;
  updatedAt: Date;
}

export interface RuleSet {
  version: number;
  priority: RulePriority[];
  entityList?: EntityListRule;
  attributeMatch?: AttributeMatchRule;
  percentage?: PercentageRule;
}

export type RulePriority = 'entityList' | 'attributeMatch' | 'percentage' | 'default';

export interface EntityListRule {
  ids: string[];
}

export interface AttributeMatchRule {
  anyOf?: AttributeCondition[];
  allOf?: AttributeCondition[];
}

export interface AttributeCondition {
  key: string;
  op: RuleOperator;
  value?: any;
  values?: any[];
}

export interface PercentageRule {
  salt: string;
  value: number; // 0-100
}

export interface Entity {
  id: string;
  projectId: string;
  type: EntityType;
  attributes: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  projectId: string;
  actorId: string;
  actorType: 'user' | 'system';
  action: string;
  targetType: string;
  targetId: string;
  payload: Record<string, any>;
  createdAt: Date;
}

// API Request/Response types
export interface EvaluateRequest {
  projectId: string;
  envId: string;
  flag: string;
  entity: {
    id: string;
    type: EntityType;
    attributes: Record<string, any>;
  };
}

export interface EvaluateResponse {
  on: boolean;
  source: 'default' | 'whitelist' | 'attribute' | 'percentage';
  ruleId?: string;
  variant?: string;
}

// SSE (Server-Sent Events) messages
export interface SSEMessage {
  type: 'flag_updated' | 'flag_deleted' | 'environment_updated';
  projectId: string;
  envId: string;
  flagId?: string;
  timestamp: string; // ISO 8601
}
/**
 * export interface SSEMessage {
  type: 'flag_updated' | 'flag_deleted' | 'environment_updated';
  projectId: string;
  envId: string;
  flagId?: string;
  timestamp: string; // ISO 8601
}

 */
