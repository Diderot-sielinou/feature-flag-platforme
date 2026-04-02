// Feature Flag Evaluation Service
//
// RESPONSIBILITIES:
// - Evaluate flags for a given context (entityId + attributes)
// - Use the 2-tier cache for ultra-fast reads (<50ms P99)
// - Fallback to the database if the cache fails
//
// EVALUATION FLOW:

// 1. Retrieve the flag state (cache → database)
// 2. Evaluate the rules in order of priority:
// entityList → attributeMatch → percentage → default
// 3. Return the result with the source of the decision

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FlagStatus } from '@prisma/client';
import {
  RuleSet,
  EvaluationContext,
  EvaluationSource,
  evaluateCondition,
  generateRolloutHash,
} from '@repo/shared';

import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../database/prisma.service';

// ==========================================================================
// TYPES
// ==========================================================================

export interface FlagState {
  flagId: string;
  flagKey: string;
  defaultState: boolean;
  rules: RuleSet;
  version: number;
}

export interface EvaluationResult {
  flagKey: string;
  enabled: boolean;
  source: EvaluationSource;
  version: number;
  ruleId?: string;
}

export interface BulkEvaluationResult {
  flags: Record<string, boolean>;
  metadata: Record<
    string,
    {
      source: EvaluationSource;
      version: number;
      ruleId?: string;
    }
  >;
}

// ==========================================================================
// SERVICE
// ==========================================================================

@Injectable()
export class EvalService {
  private readonly logger = new Logger(EvalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ==========================================================================
  // SINGLE FLAG EVALUATION
  // ==========================================================================

  /**
   * Évalue un seul flag pour une entité
   */
  async evaluateFlag(
    projectId: string,
    envId: string,
    flagKey: string,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const startTime = Date.now();

    // Récupérer l'état du flag (cache ou DB)
    const flagState = await this.getFlagState(projectId, envId, flagKey);

    if (!flagState) {
      throw new NotFoundException(`Flag not found: ${flagKey}`);
    }

    // Évaluer les règles
    const result = this.evaluate(flagState, context);

    // Log si lent (> 20ms)
    const duration = Date.now() - startTime;
    if (duration > 20) {
      this.logger.warn(`Slow flag evaluation: ${flagKey} took ${duration}ms`);
    }

    return {
      flagKey,
      enabled: result.enabled,
      source: result.source,
      version: flagState.version,
      ruleId: result.ruleId,
    };
  }

  // ==========================================================================
  // BULK EVALUATION
  // ==========================================================================

  /**
   * Evaluates all flags in an environment for an entity
   */
  async evaluateAllFlags(
    projectId: string,
    envId: string,
    context: EvaluationContext,
  ): Promise<BulkEvaluationResult> {
    const startTime = Date.now();

    // Récupérer tous les états
    const flagStates = await this.getAllFlagStates(projectId, envId);

    // Évaluer chaque flag
    const flags: Record<string, boolean> = {};
    const metadata: Record<
      string,
      { source: EvaluationSource; version: number; ruleId?: string }
    > = {};

    for (const flagState of flagStates) {
      const result = this.evaluate(flagState, context);
      flags[flagState.flagKey] = result.enabled;
      metadata[flagState.flagKey] = {
        source: result.source,
        version: flagState.version,
        ruleId: result.ruleId,
      };
    }

    // Log si lent (> 50ms pour bulk)
    const duration = Date.now() - startTime;
    if (duration > 50) {
      this.logger.warn(
        `Slow bulk evaluation: ${flagStates.length} flags took ${duration}ms`,
      );
    }

    return { flags, metadata };
  }

  /**
   * Evaluates a specific list of flags
   */
  async evaluateFlags(
    projectId: string,
    envId: string,
    flagKeys: string[],
    context: EvaluationContext,
  ): Promise<BulkEvaluationResult> {
    const flags: Record<string, boolean> = {};
    const metadata: Record<
      string,
      { source: EvaluationSource; version: number; ruleId?: string }
    > = {};

    // Fetch en parallèle
    const flagStates = await Promise.all(
      flagKeys.map((key) => this.getFlagState(projectId, envId, key)),
    );

    for (let i = 0; i < flagKeys.length; i++) {
      const flagState = flagStates[i];
      const flagKey = flagKeys[i];

      if (flagState) {
        const result = this.evaluate(flagState, context);
        flags[flagKey] = result.enabled;
        metadata[flagKey] = {
          source: result.source,
          version: flagState.version,
          ruleId: result.ruleId,
        };
      } else {
        // Flag non trouvé → false par défaut
        flags[flagKey] = false;
        metadata[flagKey] = {
          source: EvaluationSource.NOT_FOUND,
          version: 0,
        };
      }
    }

    return { flags, metadata };
  }

  // ==========================================================================
  // DATA FETCHING (Cache → DB)
  // ==========================================================================

  /**
   * Récupère l'état d'un flag depuis le cache ou la DB
   */
  private async getFlagState(
    projectId: string,
    envId: string,
    flagKey: string,
  ): Promise<FlagState | null> {
    // 1. Essayer le cache
    const cached = (await this.cache.getFlagState(
      projectId,
      envId,
      flagKey,
    )) as FlagState | null;
    if (cached) {
      return cached;
    }

    // 2. Fetch depuis la DB
    const state = await this.prisma.flagEnvironmentState.findFirst({
      where: {
        envId,
        flag: {
          projectId,
          key: flagKey,
          // Utiliser status au lieu de archived (alignement schéma Prisma)
          status: { not: FlagStatus.DELETED },
        },
      },
      include: {
        flag: {
          select: {
            id: true,
            key: true,
          },
        },
      },
    });

    if (!state) {
      return null;
    }

    const flagState: FlagState = {
      flagId: state.flag.id,
      flagKey: state.flag.key,
      defaultState: state.defaultState,
      rules: state.rules as unknown as RuleSet,
      version: state.version,
    };

    // 3. Mettre en cache pour les prochaines requêtes
    await this.cache.cacheFlagState(projectId, envId, flagKey, flagState);

    return flagState;
  }

  /**
   * Récupère tous les flags d'un environnement
   */
  private async getAllFlagStates(
    projectId: string,
    envId: string,
  ): Promise<FlagState[]> {
    // 1. Essayer le cache
    const cached = (await this.cache.getAllFlags(projectId, envId)) as
      | FlagState[]
      | null;
    if (cached) {
      return cached;
    }

    // 2. Fetch depuis la DB
    const states = await this.prisma.flagEnvironmentState.findMany({
      where: {
        envId,
        flag: {
          projectId,
          // Exclure les flags supprimés et archivés pour l'évaluation
          status: { notIn: [FlagStatus.DELETED, FlagStatus.ARCHIVED] },
        },
      },
      include: {
        flag: {
          select: {
            id: true,
            key: true,
          },
        },
      },
    });

    const flagStates: FlagState[] = states.map((state) => ({
      flagId: state.flag.id,
      flagKey: state.flag.key,
      defaultState: state.defaultState,
      rules: state.rules as unknown as RuleSet,
      version: state.version,
    }));

    // 3. Mettre en cache
    await this.cache.cacheAllFlags(projectId, envId, flagStates);

    return flagStates;
  }

  // ==========================================================================
  // RULE EVALUATION ENGINE
  // ==========================================================================

  /**
   * Évalue les règles d'un flag contre un contexte
   * Ordre de priorité: entityList → attributeMatch → percentage → default
   */
  private evaluate(
    flagState: FlagState,
    context: EvaluationContext,
  ): { enabled: boolean; source: EvaluationSource; ruleId?: string } {
    const { entityId, attributes = {} } = context;
    const rules = flagState.rules;

    // Ordre de priorité par défaut si non spécifié
    const priority = rules.priority || [
      'entityList',
      'attributeMatch',
      'percentage',
      'default',
    ];

    for (const ruleType of priority) {
      switch (ruleType) {
        // ────────────────────────────────────────────────────────────────────
        // ENTITY LIST (whitelist/blacklist)
        // ────────────────────────────────────────────────────────────────────
        case 'entityList': {
          if (rules.entityList) {
            // Blacklist = deny explicite (priorité max)
            if (rules.entityList.blacklist?.includes(entityId)) {
              return { enabled: false, source: EvaluationSource.BLACKLIST };
            }
            // Whitelist = allow explicite
            if (rules.entityList.whitelist?.includes(entityId)) {
              return { enabled: true, source: EvaluationSource.WHITELIST };
            }
          }
          break;
        }

        // ────────────────────────────────────────────────────────────────────
        // ATTRIBUTE MATCHING
        // ────────────────────────────────────────────────────────────────────
        case 'attributeMatch': {
          if (rules.attributeMatch && rules.attributeMatch.length > 0) {
            for (const rule of rules.attributeMatch) {
              // Skip les règles désactivées
              if (!rule.enabled) continue;

              // Fonction de match selon matchType (ALL = AND, ANY = OR)
              const matchFn =
                rule.matchType === 'ALL'
                  ? rule.conditions.every.bind(rule.conditions)
                  : rule.conditions.some.bind(rule.conditions);

              const matched = matchFn((cond) =>
                evaluateCondition(cond, attributes),
              );

              if (matched) {
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

        // ────────────────────────────────────────────────────────────────────
        // PERCENTAGE ROLLOUT
        // ────────────────────────────────────────────────────────────────────
        case 'percentage': {
          if (rules.percentage && rules.percentage.rollout > 0) {
            // Générer un hash déterministe basé sur entityId + flagKey
            const hash = generateRolloutHash(
              rules.percentage.salt || flagState.flagKey,
              entityId,
              flagState.flagKey,
            );

            // Si hash < rollout%, activer le flag
            if (hash < rules.percentage.rollout) {
              return { enabled: true, source: EvaluationSource.PERCENTAGE };
            }
          }
          break;
        }

        // ────────────────────────────────────────────────────────────────────
        // DEFAULT
        // ────────────────────────────────────────────────────────────────────
        case 'default':
          // Passer au return final
          break;
      }
    }

    // Aucune règle n'a matché → retourner l'état par défaut
    return {
      enabled: flagState.defaultState,
      source: EvaluationSource.DEFAULT,
    };
  }

  // ==========================================================================
  // RAW FLAG ACCESS (pour SSE bootstrap)
  // ==========================================================================

  /**
   * Retourne tous les flags bruts (pour SSE bootstrap)
   */
  async getAllFlagsRaw(projectId: string, envId: string): Promise<FlagState[]> {
    return await this.getAllFlagStates(projectId, envId);
  }
}
