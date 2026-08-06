// apps/api-read/src/modules/cache/cache.service.ts
// Service de cache 2-tier: Local (LRU) + Redis
//
// ARCHITECTURE:
// ┌─────────────────────────────────────────────────────────────────┐
// │                      CacheService                               │
// │                                                                 │
// │   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
// │   │ Request     │────►│ Local Cache │────►│   Redis     │      │
// │   │             │     │ (5s TTL)    │     │ (5min TTL)  │      │
// │   └─────────────┘     └─────────────┘     └─────────────┘      │
// │         │                   │                    │              │
// │         │◄──────────────────┴────────────────────┘              │
// │         │              Cache Hit                                │
// │         │                                                       │
// │         │              Cache Miss                               │
// │         └─────────────────────────────────────────────►Database │
// └─────────────────────────────────────────────────────────────────┘
//
// INVALIDATION (reçue via Redis Pub/Sub ou SQS):
// 1. Supprime du cache local immédiatement
// 2. Supprime de Redis
// 3. Prochain accès = fetch depuis DB + re-cache

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_KEYS, PERFORMANCE_TARGETS, REDIS_CHANNELS } from '@repo/shared';
import { createClient, RedisClientType } from 'redis';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);

  // Redis clients
  private client: RedisClientType;
  private subscriber: RedisClientType;

  // Cache local LRU pour données chaudes (sub-millisecond)
  private localCache = new Map<string, CacheEntry<unknown>>();

  // Configuration
  private readonly maxLocalItems: number;
  private readonly localTtlMs: number;
  private readonly redisHost: string;
  private readonly redisPort: number;
  private readonly redisPassword?: string;
  private readonly redisTls: boolean;

  // Stats
  private stats = {
    localHits: 0,
    redisHits: 0,
    misses: 0,
    invalidations: 0,
  };

  constructor(private readonly configService: ConfigService) {
    this.maxLocalItems =
      this.configService.get<number>('cache.maxLocalItems') || 10000;
    this.localTtlMs =
      this.configService.get<number>('cache.localTtlMs') || 5000;
    this.redisHost =
      this.configService.get<string>('redis.host') || 'localhost';
    this.redisPort = this.configService.get<number>('redis.port') || 6379;
    this.redisPassword = this.configService.get<string>('redis.password');
    this.redisTls = this.configService.get<boolean>('redis.tls') || false;
  }

  async onModuleInit() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const socketOptions: any = {
      host: this.redisHost,
      port: this.redisPort,
    };

    if (this.redisTls) {
      socketOptions.tls = true;
    }

    const redisConfig = {
      password: this.redisPassword,
      socket: socketOptions,
    };

    // Client principal pour get/set
    this.client = createClient(redisConfig);
    this.client.on('error', (err: Error) =>
      this.logger.error('Redis client error:', err),
    );
    await this.client.connect();

    // Client subscriber pour invalidation via Redis Pub/Sub
    // Note: En production, les invalidations arrivent aussi via SQS (voir EventsConsumer)
    this.subscriber = this.client.duplicate();
    await this.subscriber.connect();

    // S'abonner au channel d'invalidation
    await this.subscriber.subscribe(
      REDIS_CHANNELS.FLAG_UPDATES,
      (message: string) => this.handleInvalidationMessage(message),
    );

    this.logger.log(
      `Cache service initialized (Local: ${this.maxLocalItems} items, Redis: ${this.redisHost}:${this.redisPort})`,
    );
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
    await this.client.quit();
    this.localCache.clear();
  }

  // ==========================================================================
  // GET OPERATIONS
  // ==========================================================================

  /**
   * Récupère une valeur (local → Redis → null)
   */
  async get<T>(key: string): Promise<T | null> {
    // 1. Cache local (sub-millisecond)
    const local = this.getLocal<T>(key);
    if (local !== null) {
      this.stats.localHits++;
      return local;
    }

    // 2. Redis
    try {
      const value = await this.client.get(key);
      if (value) {
        this.stats.redisHits++;
        const parsed = JSON.parse(value) as T;
        // Populer le cache local
        this.setLocal(key, parsed);
        return parsed;
      }
    } catch (error) {
      this.logger.warn(`Redis get error for ${key}:`, error);
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Récupère plusieurs valeurs en batch
   */
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const missingKeys: string[] = [];

    // Vérifier le cache local d'abord
    for (const key of keys) {
      const local = this.getLocal<T>(key);
      if (local !== null) {
        result.set(key, local);
        this.stats.localHits++;
      } else {
        missingKeys.push(key);
      }
    }

    // Fetch les manquants depuis Redis
    if (missingKeys.length > 0) {
      try {
        const values = await this.client.mGet(missingKeys);
        for (let i = 0; i < missingKeys.length; i++) {
          const value = values[i];
          if (value) {
            const parsed = JSON.parse(value) as T;
            result.set(missingKeys[i], parsed);
            this.setLocal(missingKeys[i], parsed);
            this.stats.redisHits++;
          } else {
            this.stats.misses++;
          }
        }
      } catch (error) {
        this.logger.warn('Redis mget error:', error);
      }
    }

    return result;
  }

  // ==========================================================================
  // SET OPERATIONS
  // ==========================================================================

  /**
   * Stocke une valeur dans les deux caches
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds || PERFORMANCE_TARGETS.CACHE_TTL_SECONDS;

    // Cache local
    this.setLocal(key, value);

    // Redis
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.warn(`Redis set error for ${key}:`, error);
    }
  }

  /**
   * Stocke plusieurs valeurs en batch
   */
  async mset<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>,
  ): Promise<void> {
    // Cache local
    for (const entry of entries) {
      this.setLocal(entry.key, entry.value);
    }

    // Redis via pipeline
    try {
      const multi = this.client.multi();
      for (const entry of entries) {
        multi.setEx(
          entry.key,
          entry.ttl || PERFORMANCE_TARGETS.CACHE_TTL_SECONDS,
          JSON.stringify(entry.value),
        );
      }
      await multi.exec();
    } catch (error) {
      this.logger.warn('Redis mset error:', error);
    }
  }

  // ==========================================================================
  // DELETE / INVALIDATION
  // ==========================================================================

  /**
   * Supprime une clé des deux caches
   */
  async del(key: string): Promise<void> {
    this.localCache.delete(key);
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(`Redis del error for ${key}:`, error);
    }
  }

  /**
   * Supprime par pattern (ex: "ff:flags:proj_123:*")
   */
  async delPattern(pattern: string): Promise<number> {
    let deleted = 0;

    // Cache local
    for (const key of this.localCache.keys()) {
      if (this.matchPattern(key, pattern)) {
        this.localCache.delete(key);
        deleted++;
      }
    }

    // Redis
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        deleted += keys.length;
      }
    } catch (error) {
      this.logger.warn(`Redis delPattern error for ${pattern}:`, error);
    }

    return deleted;
  }

  /**
   * Invalide le cache d'un flag spécifique
   * Appelé par EventsConsumer quand un événement est reçu
   */
  async invalidateFlag(
    projectId: string,
    envId: string,
    flagKey: string,
  ): Promise<void> {
    this.stats.invalidations++;

    // Clé du flag individuel
    const flagCacheKey = CACHE_KEYS.FLAG_STATE(projectId, envId, flagKey);
    this.localCache.delete(flagCacheKey);

    // Clé "all flags" de l'environnement (doit être reconstruite)
    const allFlagsKey = CACHE_KEYS.ALL_FLAGS(projectId, envId);
    this.localCache.delete(allFlagsKey);

    // Supprimer de Redis aussi
    try {
      await this.client.del([flagCacheKey, allFlagsKey]);
    } catch (error) {
      this.logger.warn(`Redis invalidation error:`, error);
    }

    this.logger.debug(`Cache invalidated: flag=${flagKey} env=${envId}`);
  }

  /**
   * Invalide tout le cache d'un environnement
   */
  async invalidateEnvironment(projectId: string, envId: string): Promise<void> {
    this.stats.invalidations++;

    const pattern = CACHE_KEYS.FLAG_STATE(projectId, envId, '*');
    await this.delPattern(pattern);

    const allFlagsKey = CACHE_KEYS.ALL_FLAGS(projectId, envId);
    await this.del(allFlagsKey);

    this.logger.debug(`Cache invalidated: all flags in env=${envId}`);
  }

  /**
   * Invalide le cache d'une clé API (rotation)
   */
  async invalidateApiKey(apiKeyHash: string): Promise<void> {
    const key = CACHE_KEYS.ENV_BY_API_KEY(apiKeyHash);
    await this.del(key);
    this.logger.debug(
      `Cache invalidated: apiKey hash=${apiKeyHash.substring(0, 8)}...`,
    );
  }

  // ==========================================================================
  // FLAG-SPECIFIC OPERATIONS
  // ==========================================================================

  async getFlagState(
    projectId: string,
    envId: string,
    flagKey: string,
  ): Promise<unknown | null> {
    const key = CACHE_KEYS.FLAG_STATE(projectId, envId, flagKey);
    return await this.get(key);
  }

  async cacheFlagState(
    projectId: string,
    envId: string,
    flagKey: string,
    state: unknown,
  ): Promise<void> {
    const key = CACHE_KEYS.FLAG_STATE(projectId, envId, flagKey);
    await this.set(key, state, PERFORMANCE_TARGETS.CACHE_TTL_SECONDS);
  }

  async getAllFlags(projectId: string, envId: string): Promise<unknown | null> {
    const key = CACHE_KEYS.ALL_FLAGS(projectId, envId);
    return await this.get(key);
  }

  async cacheAllFlags(
    projectId: string,
    envId: string,
    flags: unknown,
  ): Promise<void> {
    const key = CACHE_KEYS.ALL_FLAGS(projectId, envId);
    await this.set(key, flags, PERFORMANCE_TARGETS.CACHE_TTL_SECONDS);
  }

  async getEnvironmentByApiKey(apiKeyHash: string): Promise<unknown | null> {
    const key = CACHE_KEYS.ENV_BY_API_KEY(apiKeyHash);
    return await this.get(key);
  }

  async cacheEnvironmentByApiKey(
    apiKeyHash: string,
    env: unknown,
  ): Promise<void> {
    const key = CACHE_KEYS.ENV_BY_API_KEY(apiKeyHash);
    await this.set(key, env, PERFORMANCE_TARGETS.CACHE_TTL_LONG_SECONDS);
  }

  // ==========================================================================
  // LOCAL CACHE (LRU)
  // ==========================================================================

  private getLocal<T>(key: string): T | null {
    const entry = this.localCache.get(key);
    if (!entry) return null;

    // Vérifier expiration
    if (Date.now() > entry.expiresAt) {
      this.localCache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setLocal<T>(key: string, data: T): void {
    // Éviction LRU simple si capacité atteinte
    if (this.localCache.size >= this.maxLocalItems) {
      const firstKey = this.localCache.keys().next().value;
      if (firstKey) {
        this.localCache.delete(firstKey);
      }
    }

    this.localCache.set(key, {
      data,
      expiresAt: Date.now() + this.localTtlMs,
    });
  }

  // ==========================================================================
  // INVALIDATION HANDLER (Redis Pub/Sub)
  // ==========================================================================

  /**
   * Gère les messages d'invalidation reçus via Redis Pub/Sub
   * Format: { type, projectId, envId, flagKey?, flagId?, version? }
   */
  private handleInvalidationMessage(messageStr: string): void {
    try {
      const event = JSON.parse(messageStr);
      const { type, projectId, envId, flagKey, apiKeyHash } = event;

      if (!projectId) {
        this.logger.warn('Invalid invalidation message: missing projectId');
        return;
      }

      // Gérer selon le type d'événement
      switch (type) {
        case 'flag.created':
        case 'flag.updated':
        case 'flag.state_changed':
        case 'flag.deleted':
          if (envId && flagKey) {
            // Invalider un flag spécifique
            void this.invalidateFlag(projectId, envId, flagKey);
          } else if (envId) {
            // Invalider tout l'environnement
            void this.invalidateEnvironment(projectId, envId);
          }
          break;

        case 'api_key.rotated':
          if (apiKeyHash) {
            void this.invalidateApiKey(apiKeyHash);
          }
          break;

        default:
          // Pour les types inconnus, invalider l'environnement par précaution
          if (envId) {
            void this.invalidateEnvironment(projectId, envId);
          }
      }
    } catch (error) {
      this.logger.warn('Failed to parse invalidation message:', error);
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }

  // ==========================================================================
  // HEALTH & STATS
  // ==========================================================================

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.client.ping();
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }

  getStats() {
    const total =
      this.stats.localHits + this.stats.redisHits + this.stats.misses;
    const hitRate =
      total > 0
        ? (
            ((this.stats.localHits + this.stats.redisHits) / total) *
            100
          ).toFixed(2)
        : '0';

    return {
      localHits: this.stats.localHits,
      redisHits: this.stats.redisHits,
      misses: this.stats.misses,
      invalidations: this.stats.invalidations,
      hitRate: `${hitRate}%`,
      localCacheSize: this.localCache.size,
      maxLocalItems: this.maxLocalItems,
    };
  }

  /**
   * Vide tout le cache (utile pour tests)
   */
  async flush(): Promise<void> {
    this.localCache.clear();
    try {
      await this.client.flushDb();
    } catch (error) {
      this.logger.warn('Redis flush error:', error);
    }
  }
}
