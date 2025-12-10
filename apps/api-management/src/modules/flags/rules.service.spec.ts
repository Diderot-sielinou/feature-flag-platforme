import { Test, TestingModule } from '@nestjs/testing';
import { RulesService } from './rules.service';
import { RuleOperator, EvaluationSource } from '@repo/shared';

describe('RulesService', () => {
  let service: RulesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RulesService],
    }).compile();

    service = module.get<RulesService>(RulesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateRules', () => {
    it('should validate correct rules', () => {
      const rules = {
        version: 1,
        priority: ['entityList', 'attributeMatch', 'percentage', 'default'],
        entityList: { whitelist: ['user-1'], blacklist: [] },
        attributeMatch: [
          {
            id: 'rule-1',
            name: 'Test Rule',
            conditions: [
              { attribute: 'plan', operator: RuleOperator.EQ, value: 'pro' },
            ],
            matchType: 'ALL' as const,
            enabled: true,
          },
        ],
        percentage: { salt: 'test', rollout: 50 },
      };

      const result = service.validateRules(rules);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject rules with invalid version', () => {
      const rules = {
        version: -1,
        priority: ['default'],
      };

      const result = service.validateRules(rules as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rules version must be a positive number');
    });

    it('should reject rules with invalid priority', () => {
      const rules = {
        version: 1,
        priority: ['invalid_priority'],
      };

      const result = service.validateRules(rules as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid priority type'))).toBe(true);
    });

    it('should reject rules exceeding size limit', () => {
      const largeWhitelist = Array(60000).fill('user-id');
      const rules = {
        version: 1,
        priority: ['entityList'],
        entityList: { whitelist: largeWhitelist, blacklist: [] },
      };

      const result = service.validateRules(rules as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Whitelist size'))).toBe(true);
    });

    it('should reject percentage rollout outside 0-100', () => {
      const rules = {
        version: 1,
        priority: ['percentage'],
        percentage: { salt: 'test', rollout: 150 },
      };

      const result = service.validateRules(rules as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('between 0 and 100'))).toBe(true);
    });

    it('should reject attribute rule without conditions', () => {
      const rules = {
        version: 1,
        priority: ['attributeMatch'],
        attributeMatch: [
          {
            id: 'rule-1',
            conditions: [],
            matchType: 'ALL',
            enabled: true,
          },
        ],
      };

      const result = service.validateRules(rules as any);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('at least one condition'))).toBe(true);
    });
  });

  describe('evaluate', () => {
    const defaultRules = {
      version: 1,
      priority: ['entityList', 'attributeMatch', 'percentage', 'default'] as const,
      entityList: { whitelist: [], blacklist: [] },
      attributeMatch: [],
      percentage: { salt: '', rollout: 0 },
    };

    it('should return blacklist match for blacklisted entity', () => {
      const rules = {
        ...defaultRules,
        entityList: { whitelist: [], blacklist: ['blocked-user'] },
      };

      const result = service.evaluate(
        rules,
        { entityId: 'blocked-user', attributes: {} },
        'test_flag',
        false,
      );

      expect(result.enabled).toBe(false);
      expect(result.source).toBe(EvaluationSource.BLACKLIST);
    });

    it('should return whitelist match for whitelisted entity', () => {
      const rules = {
        ...defaultRules,
        entityList: { whitelist: ['vip-user'], blacklist: [] },
      };

      const result = service.evaluate(
        rules,
        { entityId: 'vip-user', attributes: {} },
        'test_flag',
        false,
      );

      expect(result.enabled).toBe(true);
      expect(result.source).toBe(EvaluationSource.WHITELIST);
    });

    it('should evaluate attribute rules with ALL match', () => {
      const rules = {
        ...defaultRules,
        attributeMatch: [
          {
            id: 'rule-1',
            conditions: [
              { attribute: 'plan', operator: RuleOperator.EQ, value: 'pro' },
              { attribute: 'country', operator: RuleOperator.EQ, value: 'FR' },
            ],
            matchType: 'ALL' as const,
            enabled: true,
          },
        ],
      };

      const result = service.evaluate(
        rules,
        { entityId: 'user-1', attributes: { plan: 'pro', country: 'FR' } },
        'test_flag',
        false,
      );

      expect(result.enabled).toBe(true);
      expect(result.source).toBe(EvaluationSource.ATTRIBUTE);
      expect(result.ruleId).toBe('rule-1');
    });

    it('should not match attribute rule if not all conditions met', () => {
      const rules = {
        ...defaultRules,
        attributeMatch: [
          {
            id: 'rule-1',
            conditions: [
              { attribute: 'plan', operator: RuleOperator.EQ, value: 'pro' },
              { attribute: 'country', operator: RuleOperator.EQ, value: 'FR' },
            ],
            matchType: 'ALL' as const,
            enabled: true,
          },
        ],
      };

      const result = service.evaluate(
        rules,
        { entityId: 'user-1', attributes: { plan: 'pro', country: 'US' } },
        'test_flag',
        false,
      );

      expect(result.enabled).toBe(false);
      expect(result.source).toBe(EvaluationSource.DEFAULT);
    });

    it('should evaluate attribute rules with ANY match', () => {
      const rules = {
        ...defaultRules,
        attributeMatch: [
          {
            id: 'rule-1',
            conditions: [
              { attribute: 'plan', operator: RuleOperator.EQ, value: 'pro' },
              { attribute: 'plan', operator: RuleOperator.EQ, value: 'enterprise' },
            ],
            matchType: 'ANY' as const,
            enabled: true,
          },
        ],
      };

      const result = service.evaluate(
        rules,
        { entityId: 'user-1', attributes: { plan: 'enterprise' } },
        'test_flag',
        false,
      );

      expect(result.enabled).toBe(true);
      expect(result.source).toBe(EvaluationSource.ATTRIBUTE);
    });

    it('should skip disabled attribute rules', () => {
      const rules = {
        ...defaultRules,
        attributeMatch: [
          {
            id: 'rule-1',
            conditions: [
              { attribute: 'plan', operator: RuleOperator.EQ, value: 'pro' },
            ],
            matchType: 'ALL' as const,
            enabled: false,
          },
        ],
      };

      const result = service.evaluate(
        rules,
        { entityId: 'user-1', attributes: { plan: 'pro' } },
        'test_flag',
        false,
      );

      expect(result.enabled).toBe(false);
      expect(result.source).toBe(EvaluationSource.DEFAULT);
    });

    it('should evaluate percentage rollout consistently', () => {
      const rules = {
        ...defaultRules,
        percentage: { salt: 'test_salt', rollout: 50 },
      };

      // Same entity should always get the same result
      const result1 = service.evaluate(
        rules,
        { entityId: 'consistent-user', attributes: {} },
        'test_flag',
        false,
      );

      const result2 = service.evaluate(
        rules,
        { entityId: 'consistent-user', attributes: {} },
        'test_flag',
        false,
      );

      expect(result1.enabled).toBe(result2.enabled);
    });

    it('should return default state when no rules match', () => {
      const result = service.evaluate(
        defaultRules,
        { entityId: 'user-1', attributes: {} },
        'test_flag',
        true, // defaultState = true
      );

      expect(result.enabled).toBe(true);
      expect(result.source).toBe(EvaluationSource.DEFAULT);
    });

    it('should respect priority order', () => {
      // Blacklist should take precedence even if also whitelisted
      const rules = {
        ...defaultRules,
        entityList: { whitelist: ['user-1'], blacklist: ['user-1'] },
      };

      const result = service.evaluate(
        rules,
        { entityId: 'user-1', attributes: {} },
        'test_flag',
        false,
      );

      expect(result.enabled).toBe(false);
      expect(result.source).toBe(EvaluationSource.BLACKLIST);
    });
  });

  describe('condition operators', () => {
    const baseRules = {
      version: 1,
      priority: ['attributeMatch'] as const,
      attributeMatch: [] as any[],
    };

    const testCondition = (
      operator: RuleOperator,
      attrValue: unknown,
      condValue?: unknown,
      condValues?: unknown[],
    ) => {
      const rules = {
        ...baseRules,
        attributeMatch: [
          {
            id: 'test',
            conditions: [
              { attribute: 'attr', operator, value: condValue, values: condValues },
            ],
            matchType: 'ALL' as const,
            enabled: true,
          },
        ],
      };

      return service.evaluate(
        rules,
        { entityId: 'user', attributes: { attr: attrValue } },
        'flag',
        false,
      );
    };

    it('should handle EQ operator', () => {
      expect(testCondition(RuleOperator.EQ, 'test', 'test').enabled).toBe(true);
      expect(testCondition(RuleOperator.EQ, 'test', 'other').enabled).toBe(false);
    });

    it('should handle NEQ operator', () => {
      expect(testCondition(RuleOperator.NEQ, 'test', 'other').enabled).toBe(true);
      expect(testCondition(RuleOperator.NEQ, 'test', 'test').enabled).toBe(false);
    });

    it('should handle GT operator', () => {
      expect(testCondition(RuleOperator.GT, 10, 5).enabled).toBe(true);
      expect(testCondition(RuleOperator.GT, 5, 10).enabled).toBe(false);
    });

    it('should handle GTE operator', () => {
      expect(testCondition(RuleOperator.GTE, 10, 10).enabled).toBe(true);
      expect(testCondition(RuleOperator.GTE, 10, 11).enabled).toBe(false);
    });

    it('should handle LT operator', () => {
      expect(testCondition(RuleOperator.LT, 5, 10).enabled).toBe(true);
      expect(testCondition(RuleOperator.LT, 10, 5).enabled).toBe(false);
    });

    it('should handle LTE operator', () => {
      expect(testCondition(RuleOperator.LTE, 10, 10).enabled).toBe(true);
      expect(testCondition(RuleOperator.LTE, 11, 10).enabled).toBe(false);
    });

    it('should handle IN operator', () => {
      expect(testCondition(RuleOperator.IN, 'a', undefined, ['a', 'b', 'c']).enabled).toBe(true);
      expect(testCondition(RuleOperator.IN, 'd', undefined, ['a', 'b', 'c']).enabled).toBe(false);
    });

    it('should handle NOT_IN operator', () => {
      expect(testCondition(RuleOperator.NOT_IN, 'd', undefined, ['a', 'b', 'c']).enabled).toBe(true);
      expect(testCondition(RuleOperator.NOT_IN, 'a', undefined, ['a', 'b', 'c']).enabled).toBe(false);
    });

    it('should handle CONTAINS operator', () => {
      expect(testCondition(RuleOperator.CONTAINS, 'hello world', 'world').enabled).toBe(true);
      expect(testCondition(RuleOperator.CONTAINS, 'hello', 'world').enabled).toBe(false);
    });

    it('should handle NOT_CONTAINS operator', () => {
      expect(testCondition(RuleOperator.NOT_CONTAINS, 'hello', 'world').enabled).toBe(true);
      expect(testCondition(RuleOperator.NOT_CONTAINS, 'hello world', 'world').enabled).toBe(false);
    });

    it('should handle STARTS_WITH operator', () => {
      expect(testCondition(RuleOperator.STARTS_WITH, 'hello world', 'hello').enabled).toBe(true);
      expect(testCondition(RuleOperator.STARTS_WITH, 'hello world', 'world').enabled).toBe(false);
    });

    it('should handle ENDS_WITH operator', () => {
      expect(testCondition(RuleOperator.ENDS_WITH, 'hello world', 'world').enabled).toBe(true);
      expect(testCondition(RuleOperator.ENDS_WITH, 'hello world', 'hello').enabled).toBe(false);
    });

    it('should handle REGEX operator', () => {
      expect(testCondition(RuleOperator.REGEX, 'test123', '^test\\d+$').enabled).toBe(true);
      expect(testCondition(RuleOperator.REGEX, 'test', '^test\\d+$').enabled).toBe(false);
    });

    it('should handle EXISTS operator', () => {
      const rules = {
        ...baseRules,
        attributeMatch: [
          {
            id: 'test',
            conditions: [{ attribute: 'attr', operator: RuleOperator.EXISTS }],
            matchType: 'ALL' as const,
            enabled: true,
          },
        ],
      };

      const existsResult = service.evaluate(
        rules,
        { entityId: 'user', attributes: { attr: 'value' } },
        'flag',
        false,
      );
      expect(existsResult.enabled).toBe(true);

      const notExistsResult = service.evaluate(
        rules,
        { entityId: 'user', attributes: {} },
        'flag',
        false,
      );
      expect(notExistsResult.enabled).toBe(false);
    });

    it('should handle NOT_EXISTS operator', () => {
      const rules = {
        ...baseRules,
        attributeMatch: [
          {
            id: 'test',
            conditions: [{ attribute: 'attr', operator: RuleOperator.NOT_EXISTS }],
            matchType: 'ALL' as const,
            enabled: true,
          },
        ],
      };

      const result = service.evaluate(
        rules,
        { entityId: 'user', attributes: {} },
        'flag',
        false,
      );
      expect(result.enabled).toBe(true);
    });
  });

  describe('whitelist/blacklist manipulation', () => {
    const baseRules = {
      version: 1,
      priority: ['entityList'] as const,
      entityList: { whitelist: ['user-1'], blacklist: ['user-2'] },
    };

    it('should add to whitelist and remove from blacklist', () => {
      const result = service.addToWhitelist(baseRules, ['user-2', 'user-3']);

      expect(result.entityList!.whitelist).toContain('user-2');
      expect(result.entityList!.whitelist).toContain('user-3');
      expect(result.entityList!.blacklist).not.toContain('user-2');
    });

    it('should add to blacklist and remove from whitelist', () => {
      const result = service.addToBlacklist(baseRules, ['user-1', 'user-4']);

      expect(result.entityList!.blacklist).toContain('user-1');
      expect(result.entityList!.blacklist).toContain('user-4');
      expect(result.entityList!.whitelist).not.toContain('user-1');
    });

    it('should remove from whitelist', () => {
      const result = service.removeFromWhitelist(baseRules, ['user-1']);

      expect(result.entityList!.whitelist).not.toContain('user-1');
    });

    it('should remove from blacklist', () => {
      const result = service.removeFromBlacklist(baseRules, ['user-2']);

      expect(result.entityList!.blacklist).not.toContain('user-2');
    });
  });

  describe('getDefaultRuleSet', () => {
    it('should return a valid default rule set', () => {
      const rules = service.getDefaultRuleSet();

      expect(rules.version).toBe(1);
      expect(rules.priority).toEqual(['entityList', 'attributeMatch', 'percentage', 'default']);
      expect(rules.entityList!.whitelist).toEqual([]);
      expect(rules.entityList!.blacklist).toEqual([]);
      expect(rules.attributeMatch).toEqual([]);
      expect(rules.percentage!.rollout).toBe(0);
    });
  });
});
