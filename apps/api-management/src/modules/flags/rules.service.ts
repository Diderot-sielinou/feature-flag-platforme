import { Injectable, Logger } from '@nestjs/common';
import {
  RuleSet,
  RuleOperator,
  AttributeCondition,
  EvaluationContext,
  EvaluationSource,
  LIMITS,
  generateRolloutHash,
  evaluateCondition,
  getRulesSizeKB,
} from '@repo/shared';

export interface EvaluationResult {
  enabled: boolean;
  source: EvaluationSource;
  ruleId?: string;
  evaluationPath: string[];
}

@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);

  /**
   * Validate rules before saving
   */
  validateRules(rules: RuleSet): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check size limit
    const sizeKB = getRulesSizeKB(rules);
    if (sizeKB > LIMITS.MAX_RULES_SIZE_KB) {
      errors.push(`Rules size (${sizeKB.toFixed(2)} KB) exceeds maximum (${LIMITS.MAX_RULES_SIZE_KB} KB)`);
    }

    // Validate version
    if (typeof rules.version !== 'number' || rules.version < 1) {
      errors.push('Rules version must be a positive number');
    }

    // Validate priority
    const validPriorities = ['entityList', 'attributeMatch', 'percentage', 'default'];
    if (!Array.isArray(rules.priority)) {
      errors.push('Rules priority must be an array');
    } else {
      for (const p of rules.priority) {
        if (!validPriorities.includes(p)) {
          errors.push(`Invalid priority type: ${p}`);
        }
      }
    }

    // Validate entity list
    if (rules.entityList) {
      if (rules.entityList.whitelist && rules.entityList.whitelist.length > LIMITS.MAX_WHITELIST_SIZE) {
        errors.push(`Whitelist size (${rules.entityList.whitelist.length}) exceeds maximum (${LIMITS.MAX_WHITELIST_SIZE})`);
      }
      if (rules.entityList.blacklist && rules.entityList.blacklist.length > LIMITS.MAX_BLACKLIST_SIZE) {
        errors.push(`Blacklist size (${rules.entityList.blacklist.length}) exceeds maximum (${LIMITS.MAX_BLACKLIST_SIZE})`);
      }
    }

    // Validate attribute rules
    if (rules.attributeMatch) {
      if (rules.attributeMatch.length > LIMITS.MAX_ATTRIBUTE_RULES) {
        errors.push(`Too many attribute rules (${rules.attributeMatch.length}), maximum is ${LIMITS.MAX_ATTRIBUTE_RULES}`);
      }

      for (const rule of rules.attributeMatch) {
        if (!rule.id) {
          errors.push('Attribute rule missing ID');
        }
        if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) {
          errors.push(`Attribute rule ${rule.id} must have at least one condition`);
        }
        for (const cond of rule.conditions) {
          const condErrors = this.validateCondition(cond);
          errors.push(...condErrors);
        }
      }
    }

    // Validate percentage rule
    if (rules.percentage) {
      if (typeof rules.percentage.rollout !== 'number') {
        errors.push('Percentage rollout must be a number');
      } else if (rules.percentage.rollout < 0 || rules.percentage.rollout > 100) {
        errors.push('Percentage rollout must be between 0 and 100');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a single condition
   */
  private validateCondition(condition: AttributeCondition): string[] {
    const errors: string[] = [];

    if (!condition.attribute || typeof condition.attribute !== 'string') {
      errors.push('Condition missing attribute name');
    }

    if (!condition.operator || !Object.values(RuleOperator).includes(condition.operator)) {
      errors.push(`Invalid operator: ${condition.operator}`);
    }

    // Check that value/values is provided based on operator
    const operatorsRequiringValue = [
      RuleOperator.EQ,
      RuleOperator.NEQ,
      RuleOperator.GT,
      RuleOperator.GTE,
      RuleOperator.LT,
      RuleOperator.LTE,
      RuleOperator.CONTAINS,
      RuleOperator.NOT_CONTAINS,
      RuleOperator.STARTS_WITH,
      RuleOperator.ENDS_WITH,
      RuleOperator.REGEX,
    ];

    const operatorsRequiringValues = [RuleOperator.IN, RuleOperator.NOT_IN];
    // const operatorsNoValue = [RuleOperator.EXISTS, RuleOperator.NOT_EXISTS];

    if (operatorsRequiringValue.includes(condition.operator) && condition.value === undefined) {
      errors.push(`Operator ${condition.operator} requires a value`);
    }

    if (operatorsRequiringValues.includes(condition.operator)) {
      if (!Array.isArray(condition.values) || condition.values.length === 0) {
        errors.push(`Operator ${condition.operator} requires a non-empty values array`);
      }
    }

    return errors;
  }

  /**
   * Evaluate rules against a context
   */
  evaluate(
    rules: RuleSet,
    context: EvaluationContext,
    flagKey: string,
    defaultState: boolean,
  ): EvaluationResult {
    const evaluationPath: string[] = [];
    const { entityId, attributes = {} } = context;

    const priority = rules.priority || ['entityList', 'attributeMatch', 'percentage', 'default'];

    for (const ruleType of priority) {
      evaluationPath.push(`checking:${ruleType}`);

      switch (ruleType) {
        case 'entityList': {
          if (rules.entityList) {
            // Check blacklist first (explicit deny)
            if (rules.entityList.blacklist?.includes(entityId)) {
              evaluationPath.push('matched:blacklist');
              return {
                enabled: false,
                source: EvaluationSource.BLACKLIST,
                evaluationPath,
              };
            }
            // Check whitelist
            if (rules.entityList.whitelist?.includes(entityId)) {
              evaluationPath.push('matched:whitelist');
              return {
                enabled: true,
                source: EvaluationSource.WHITELIST,
                evaluationPath,
              };
            }
          }
          evaluationPath.push('no_match:entityList');
          break;
        }

        case 'attributeMatch': {
          if (rules.attributeMatch && rules.attributeMatch.length > 0) {
            for (const rule of rules.attributeMatch) {
              if (!rule.enabled) {
                evaluationPath.push(`skipped:rule_${rule.id}_disabled`);
                continue;
              }

              const matchFn =
                rule.matchType === 'ALL'
                  ? rule.conditions.every.bind(rule.conditions)
                  : rule.conditions.some.bind(rule.conditions);

              const matched = matchFn((cond) =>
                evaluateCondition(cond, attributes),
              );

              if (matched) {
                evaluationPath.push(`matched:attribute_rule_${rule.id}`);
                return {
                  enabled: true,
                  source: EvaluationSource.ATTRIBUTE,
                  ruleId: rule.id,
                  evaluationPath,
                };
              }
            }
          }
          evaluationPath.push('no_match:attributeMatch');
          break;
        }

        case 'percentage': {
          if (rules.percentage && rules.percentage.rollout > 0) {
            const hash = generateRolloutHash(
              rules.percentage.salt || flagKey,
              entityId,
              flagKey,
            );

            evaluationPath.push(`percentage:hash=${hash.toFixed(2)},rollout=${rules.percentage.rollout}`);

            if (hash < rules.percentage.rollout) {
              evaluationPath.push('matched:percentage');
              return {
                enabled: true,
                source: EvaluationSource.PERCENTAGE,
                evaluationPath,
              };
            }
          }
          evaluationPath.push('no_match:percentage');
          break;
        }

        case 'default':
          // Fall through to return default
          break;
      }
    }

    evaluationPath.push('returning:default');
    return {
      enabled: defaultState,
      source: EvaluationSource.DEFAULT,
      evaluationPath,
    };
  }

  /**
   * Get default empty ruleset
   */
  getDefaultRuleSet(): RuleSet {
    return {
      version: 1,
      priority: ['entityList', 'attributeMatch', 'percentage', 'default'],
      entityList: {
        whitelist: [],
        blacklist: [],
      },
      attributeMatch: [],
      percentage: {
        salt: '',
        rollout: 0,
      },
    };
  }

  /**
   * Merge rules for whitelist/blacklist updates
   */
  addToWhitelist(currentRules: RuleSet, entityIds: string[]): RuleSet {
    const rules = { ...currentRules };
    if (!rules.entityList) {
      rules.entityList = { whitelist: [], blacklist: [] };
    }

    // Add new IDs, avoiding duplicates
    const currentWhitelist = new Set(rules.entityList.whitelist || []);
    for (const id of entityIds) {
      currentWhitelist.add(id);
      // Remove from blacklist if present
      rules.entityList.blacklist = (rules.entityList.blacklist || []).filter(
        (bid) => bid !== id,
      );
    }

    rules.entityList.whitelist = Array.from(currentWhitelist);
    return rules;
  }

  /**
   * Remove from whitelist
   */
  removeFromWhitelist(currentRules: RuleSet, entityIds: string[]): RuleSet {
    const rules = { ...currentRules };
    if (!rules.entityList) {
      return rules;
    }

    const toRemove = new Set(entityIds);
    rules.entityList.whitelist = (rules.entityList.whitelist || []).filter(
      (id) => !toRemove.has(id),
    );

    return rules;
  }

  /**
   * Add to blacklist
   */
  addToBlacklist(currentRules: RuleSet, entityIds: string[]): RuleSet {
    const rules = { ...currentRules };
    if (!rules.entityList) {
      rules.entityList = { whitelist: [], blacklist: [] };
    }

    const currentBlacklist = new Set(rules.entityList.blacklist || []);
    for (const id of entityIds) {
      currentBlacklist.add(id);
      // Remove from whitelist if present
      rules.entityList.whitelist = (rules.entityList.whitelist || []).filter(
        (wid) => wid !== id,
      );
    }

    rules.entityList.blacklist = Array.from(currentBlacklist);
    return rules;
  }

  /**
   * Remove from blacklist
   */
  removeFromBlacklist(currentRules: RuleSet, entityIds: string[]): RuleSet {
    const rules = { ...currentRules };
    if (!rules.entityList) {
      return rules;
    }

    const toRemove = new Set(entityIds);
    rules.entityList.blacklist = (rules.entityList.blacklist || []).filter(
      (id) => !toRemove.has(id),
    );

    return rules;
  }
}
