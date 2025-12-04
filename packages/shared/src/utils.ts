// =============================================================================
// LaunchLayer - Shared Utilities
// =============================================================================

import * as crypto from 'crypto';

import {
  type RuleSet,
  RuleOperator,
  type AttributeCondition,
  type EvaluationContext,
  EvaluationSource,
} from './types.js';

// =============================================================================
// CRYPTO UTILITIES
// =============================================================================

/**
 * Generate a secure random API key
 */
export function generateApiKey(prefix: string = 'ff'): string {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `${prefix}_${randomPart}`;
}

/**
 * Hash an API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Generate a secure random token (for invitations, etc.)
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate a deterministic hash for percentage rollout
 */
export function generateRolloutHash(salt: string, entityId: string, flagKey: string): number {
  const input = `${salt}:${entityId}:${flagKey}`;
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  // Take first 8 hex characters and convert to number between 0-100
  const hashValue = parseInt(hash.substring(0, 8), 16);
  return (hashValue % 10000) / 100; // Returns 0.00 to 99.99
}

/**
 * Generate a CUID-like ID
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('base64url');
  return `${timestamp}${random}`.substring(0, 25);
}

// =============================================================================
// SLUG UTILITIES
// =============================================================================

/**
 * Generate a URL-safe slug from a string
 */
export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Ensure slug uniqueness by appending random suffix if needed
 */
export function ensureUniqueSlug(baseSlug: string): string {
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${baseSlug}-${suffix}`;
}

// =============================================================================
// RULE EVALUATION UTILITIES
// =============================================================================

/**
 * Evaluate a single attribute condition
 */
export function evaluateCondition(
  condition: AttributeCondition,
  attributes: Record<string, unknown>,
): boolean {
  const { attribute, operator, value, values } = condition;
  const attrValue = attributes[attribute];

  switch (operator) {
    case RuleOperator.EQ:
      return attrValue === value;

    case RuleOperator.NEQ:
      return attrValue !== value;

    case RuleOperator.IN:
      return Array.isArray(values) && values.includes(attrValue);

    case RuleOperator.NOT_IN:
      return Array.isArray(values) && !values.includes(attrValue);

    case RuleOperator.GT:
      return typeof attrValue === 'number' && typeof value === 'number' && attrValue > value;

    case RuleOperator.GTE:
      return typeof attrValue === 'number' && typeof value === 'number' && attrValue >= value;

    case RuleOperator.LT:
      return typeof attrValue === 'number' && typeof value === 'number' && attrValue < value;

    case RuleOperator.LTE:
      return typeof attrValue === 'number' && typeof value === 'number' && attrValue <= value;

    case RuleOperator.CONTAINS:
      return (
        typeof attrValue === 'string' && typeof value === 'string' && attrValue.includes(value)
      );

    case RuleOperator.NOT_CONTAINS:
      return (
        typeof attrValue === 'string' && typeof value === 'string' && !attrValue.includes(value)
      );

    case RuleOperator.STARTS_WITH:
      return (
        typeof attrValue === 'string' && typeof value === 'string' && attrValue.startsWith(value)
      );

    case RuleOperator.ENDS_WITH:
      return (
        typeof attrValue === 'string' && typeof value === 'string' && attrValue.endsWith(value)
      );

    case RuleOperator.REGEX:
      if (typeof attrValue !== 'string' || typeof value !== 'string') return false;
      try {
        return new RegExp(value).test(attrValue);
      } catch {
        return false;
      }

    case RuleOperator.EXISTS:
      return attrValue !== undefined && attrValue !== null;

    case RuleOperator.NOT_EXISTS:
      return attrValue === undefined || attrValue === null;

    default:
      return false;
  }
}

/**
 * Evaluate a full rule set against an entity context
 */
export function evaluateRuleSet(
  rules: RuleSet,
  context: EvaluationContext,
  flagKey: string,
): { enabled: boolean; source: EvaluationSource; ruleId?: string } {
  const { entityId, attributes = {} } = context;
  const priority = rules.priority || ['entityList', 'attributeMatch', 'percentage', 'default'];

  for (const ruleType of priority) {
    switch (ruleType) {
      case 'entityList': {
        if (rules.entityList) {
          // Check blacklist first (explicit deny)
          if (rules.entityList.blacklist?.includes(entityId)) {
            return { enabled: false, source: EvaluationSource.BLACKLIST };
          }
          // Check whitelist
          if (rules.entityList.whitelist?.includes(entityId)) {
            return { enabled: true, source: EvaluationSource.WHITELIST };
          }
        }
        break;
      }

      case 'attributeMatch': {
        if (rules.attributeMatch && rules.attributeMatch.length > 0) {
          for (const rule of rules.attributeMatch) {
            if (!rule.enabled) continue;

            const matchFn =
              rule.matchType === 'ALL'
                ? rule.conditions.every.bind(rule.conditions)
                : rule.conditions.some.bind(rule.conditions);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (matchFn((cond: any) => evaluateCondition(cond, attributes))) {
              return {
                enabled: true,
                source: EvaluationSource.ATTRIBUTE,
                ruleId: rule.id,
              };
            }
          }
        }
        break;
      }

      case 'percentage': {
        if (rules.percentage && rules.percentage.rollout > 0) {
          const hash = generateRolloutHash(rules.percentage.salt || flagKey, entityId, flagKey);
          if (hash < rules.percentage.rollout) {
            return { enabled: true, source: EvaluationSource.PERCENTAGE };
          }
        }
        break;
      }

      case 'default': {
        // Fall through to default at the end
        break;
      }
    }
  }

  // Return default state
  return { enabled: false, source: EvaluationSource.DEFAULT };
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Validate a flag key format
 */
export function isValidFlagKey(key: string): boolean {
  // Must be lowercase, alphanumeric with underscores, 3-128 chars
  const pattern = /^[a-z][a-z0-9_]{2,127}$/;
  return pattern.test(key);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

/**
 * Validate a slug format
 */
export function isValidSlug(slug: string): boolean {
  const pattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  return pattern.test(slug) && slug.length >= 2 && slug.length <= 50;
}

/**
 * Calculate the size of a rules object in KB
 */
export function getRulesSizeKB(rules: RuleSet): number {
  const jsonString = JSON.stringify(rules);
  return Buffer.byteLength(jsonString, 'utf8') / 1024;
}

// =============================================================================
// DATE UTILITIES
// =============================================================================

/**
 * Get ISO string timestamp
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Add hours to current date
 */
export function addHours(hours: number): Date {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}

/**
 * Check if a date has expired
 */
export function isExpired(date: Date): boolean {
  return new Date() > new Date(date);
}

// =============================================================================
// OBJECT UTILITIES
// =============================================================================

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Remove undefined values from an object
 */
export function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}

/**
 * Pick specific keys from an object
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from an object
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

// =============================================================================
// ARRAY UTILITIES
// =============================================================================

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get unique values from an array
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

// =============================================================================
// ASYNC UTILITIES
// =============================================================================

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  } = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000 } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        break;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
}
