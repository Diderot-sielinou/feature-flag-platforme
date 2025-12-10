// src/modules/redis/redis.service.ts

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, ChainableCommander } from 'ioredis';
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const config = {
      host: this.configService.get<string>('redis.host') || 'localhost',
      port: this.configService.get<number>('redis.port') || 6379,
      password: this.configService.get<string>('redis.password'),
      tls: this.configService.get<boolean>('redis.tls') ? {} : undefined,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    try {
      // Main client for get/set operations
      this.client = new Redis(config);

      // Separate clients for pub/sub (required by Redis)
      this.subscriber = new Redis(config);
      this.publisher = new Redis(config);

      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect(),
      ]);

      this.isConnected = true;
      this.logger.log(`Redis connected to ${config.host}:${config.port}`);

      // Handle connection events
      this.client.on('error', (err: unknown) => {
        this.logger.error('Redis client error', err);
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        this.logger.warn('Redis reconnecting...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.logger.log('Redis ready');
      });
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      // Don't throw - allow app to start without Redis in dev
      this.isConnected = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.client?.quit(),
      this.subscriber?.quit(),
      this.publisher?.quit(),
    ]);
    this.logger.log('Redis connections closed');
  }

  // ===========================================================================
  // CONNECTION STATUS
  // ===========================================================================

  isReady(): boolean {
    return this.isConnected;
  }

  // ===========================================================================
  // BASIC OPERATIONS
  // ===========================================================================

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Redis GET error for key ${key}`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}`, error);
      return false;
    }
  }

  async setEx(
    key: string,
    ttlSeconds: number,
    value: string,
  ): Promise<boolean> {
    return await this.set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Redis DEL error for key ${key}`, error);
      return false;
    }
  }

  async delPattern(pattern: string): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      return await this.client.del(...keys);
    } catch (error) {
      this.logger.error(`Redis DEL pattern error for ${pattern}`, error);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS error for key ${key}`, error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isConnected) return -1;
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Redis TTL error for key ${key}`, error);
      return -1;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      await this.client.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      this.logger.error(`Redis EXPIRE error for key ${key}`, error);
      return false;
    }
  }

  // ===========================================================================
  // JSON OPERATIONS (convenience wrappers)
  // ===========================================================================

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async setJson<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<boolean> {
    return await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  // ===========================================================================
  // HASH OPERATIONS
  // ===========================================================================

  async hget(key: string, field: string): Promise<string | null> {
    if (!this.isConnected) return null;
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      this.logger.error(`Redis HGET error for ${key}.${field}`, error);
      return null;
    }
  }

  async hset(key: string, field: string, value: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      await this.client.hset(key, field, value);
      return true;
    } catch (error) {
      this.logger.error(`Redis HSET error for ${key}.${field}`, error);
      return false;
    }
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    if (!this.isConnected) return null;
    try {
      const result = await this.client.hgetall(key);
      return Object.keys(result).length > 0 ? result : null;
    } catch (error) {
      this.logger.error(`Redis HGETALL error for ${key}`, error);
      return null;
    }
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.hdel(key, ...fields);
    } catch (error) {
      this.logger.error(`Redis HDEL error for ${key}`, error);
      return 0;
    }
  }

  // ===========================================================================
  // SET OPERATIONS
  // ===========================================================================

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.sadd(key, ...members);
    } catch (error) {
      this.logger.error(`Redis SADD error for ${key}`, error);
      return 0;
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.srem(key, ...members);
    } catch (error) {
      this.logger.error(`Redis SREM error for ${key}`, error);
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.isConnected) return [];
    try {
      return await this.client.smembers(key);
    } catch (error) {
      this.logger.error(`Redis SMEMBERS error for ${key}`, error);
      return [];
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const result = await this.client.sismember(key, member);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis SISMEMBER error for ${key}`, error);
      return false;
    }
  }

  async scard(key: string): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.scard(key);
    } catch (error) {
      this.logger.error(`Redis SCARD error for ${key}`, error);
      return 0;
    }
  }

  // ===========================================================================
  // PUB/SUB OPERATIONS
  // ===========================================================================

  async publish(channel: string, message: unknown): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      const payload =
        typeof message === 'string' ? message : JSON.stringify(message);
      return await this.publisher.publish(channel, payload);
    } catch (error) {
      this.logger.error(`Redis PUBLISH error for channel ${channel}`, error);
      return 0;
    }
  }

  async subscribe(
    channel: string,
    callback: (message: string, channel: string) => void,
  ): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (ch: string, msg: string) => {
        if (ch === channel) {
          callback(msg, ch);
        }
      });
      this.logger.debug(`Subscribed to channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Redis SUBSCRIBE error for channel ${channel}`, error);
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.subscriber.unsubscribe(channel);
      this.logger.debug(`Unsubscribed from channel: ${channel}`);
    } catch (error) {
      this.logger.error(
        `Redis UNSUBSCRIBE error for channel ${channel}`,
        error,
      );
    }
  }

  // ===========================================================================
  // ATOMIC OPERATIONS
  // ===========================================================================

  async incr(key: string): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(`Redis INCR error for ${key}`, error);
      return 0;
    }
  }

  async incrBy(key: string, increment: number): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.incrby(key, increment);
    } catch (error) {
      this.logger.error(`Redis INCRBY error for ${key}`, error);
      return 0;
    }
  }

  async decr(key: string): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      return await this.client.decr(key);
    } catch (error) {
      this.logger.error(`Redis DECR error for ${key}`, error);
      return 0;
    }
  }

  // ===========================================================================
  // MULTI/PIPELINE (for atomic operations)
  // ===========================================================================

  multi(): ChainableCommander {
    return this.client.multi();
  }

  pipeline(): ChainableCommander {
    return this.client.pipeline();
  }

  // ===========================================================================
  // UTILITY
  // ===========================================================================

  async ping(): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async flushDb(): Promise<void> {
    if (!this.isConnected) return;
    if (this.configService.get<string>('nodeEnv') === 'production') {
      throw new Error('Cannot flush database in production');
    }
    await this.client.flushdb();
    this.logger.warn('Redis database flushed');
  }
}
