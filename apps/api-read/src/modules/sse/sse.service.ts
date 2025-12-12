import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CHANNELS, SSEMessageType } from '@repo/shared';
import { Response } from 'express';
import { createClient, RedisClientType } from 'redis';

import { EvalService } from '../eval/eval.service';

interface SSEConnection {
  id: string;
  projectId: string;
  envId: string;
  response: Response;
  lastEventId?: number;
  createdAt: Date;
}

interface SSEMessage {
  type: SSEMessageType;
  data: unknown;
  timestamp: string;
}

@Injectable()
export class SSEService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SSEService.name);

  // Active connections by environment
  private connections = new Map<string, Map<string, SSEConnection>>();

  // Connection counts by project
  private connectionCounts = new Map<string, number>();

  // Redis subscriber
  private subscriber: RedisClientType;

  // Configuration
  private readonly heartbeatInterval: number;
  private readonly maxConnectionsPerProject: number;

  // Heartbeat timer
  private heartbeatTimer?: NodeJS.Timeout;

  // Event ID counter
  private eventId = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly evalService: EvalService,
  ) {
    this.heartbeatInterval =
      this.configService.get<number>('sse.heartbeatIntervalMs') || 30000;
    this.maxConnectionsPerProject =
      this.configService.get<number>('sse.maxConnectionsPerProject') || 10000;
  }

  async onModuleInit() {
    // Connect to Redis for receiving updates
    const redisConfig = {
      socket: {
        host: this.configService.get<string>('redis.host'),
        port: this.configService.get<number>('redis.port'),
      },
      password: this.configService.get<string>('redis.password'),
    };

    this.subscriber = createClient(redisConfig);
    this.subscriber.on('error', (err) =>
      this.logger.error('Redis subscriber error:', err),
    );
    await this.subscriber.connect();

    // Subscribe to flag update channel
    await this.subscriber.subscribe(REDIS_CHANNELS.FLAG_UPDATES, (message) => {
      this.handleFlagUpdate(message);
    });

    // Start heartbeat
    this.startHeartbeat();

    this.logger.log('SSE service initialized');
  }

  async onModuleDestroy() {
    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Close all connections
    for (const envConnections of this.connections.values()) {
      for (const conn of envConnections.values()) {
        try {
          conn.response.end();
        } catch {
          // Ignore errors on cleanup
        }
      }
    }

    // Disconnect Redis
    await this.subscriber.quit();
  }

  // ==========================================================================
  // CONNECTION MANAGEMENT
  // ==========================================================================

  /**
   * Add a new SSE connection
   */
  async addConnection(
    connectionId: string,
    projectId: string,
    envId: string,
    response: Response,
    lastEventId?: number,
  ): Promise<{ success: boolean; error?: string }> {
    const envKey = `${projectId}:${envId}`;

    // Check connection limit
    const currentCount = this.connectionCounts.get(projectId) || 0;
    if (currentCount >= this.maxConnectionsPerProject) {
      return {
        success: false,
        error: `Maximum connections (${this.maxConnectionsPerProject}) reached for this project`,
      };
    }

    // Initialize environment map if needed
    if (!this.connections.has(envKey)) {
      this.connections.set(envKey, new Map());
    }

    // Add connection
    const connection: SSEConnection = {
      id: connectionId,
      projectId,
      envId,
      response,
      lastEventId,
      createdAt: new Date(),
    };

    this.connections.get(envKey)!.set(connectionId, connection);
    this.connectionCounts.set(projectId, currentCount + 1);

    // Set up cleanup on close
    response.on('close', () => {
      this.removeConnection(connectionId, projectId, envId);
    });

    this.logger.debug(`SSE connection added: ${connectionId} for ${envKey}`);

    // Send initial bootstrap
    await this.sendBootstrap(connection);

    return { success: true };
  }

  /**
   * Remove a connection
   */
  removeConnection(
    connectionId: string,
    projectId: string,
    envId: string,
  ): void {
    const envKey = `${projectId}:${envId}`;
    const envConnections = this.connections.get(envKey);

    if (envConnections) {
      envConnections.delete(connectionId);

      // Clean up empty maps
      if (envConnections.size === 0) {
        this.connections.delete(envKey);
      }
    }

    // Update connection count
    const currentCount = this.connectionCounts.get(projectId) || 0;
    if (currentCount > 0) {
      this.connectionCounts.set(projectId, currentCount - 1);
    }

    this.logger.debug(`SSE connection removed: ${connectionId}`);
  }

  // ==========================================================================
  // MESSAGE SENDING
  // ==========================================================================

  /**
   * Send bootstrap data to a new connection
   */
  private async sendBootstrap(connection: SSEConnection): Promise<void> {
    try {
      // Get all current flag states
      const flags = await this.evalService.getAllFlagsRaw(
        connection.projectId,
        connection.envId,
      );

      // Send bootstrap message
      this.sendToConnection(connection, {
        type: SSEMessageType.BOOTSTRAP,
        data: {
          flags: flags.map((f) => ({
            key: f.flagKey,
            defaultState: f.defaultState,
            version: f.version,
          })),
        },
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Bootstrap sent to ${connection.id}`);
    } catch (error) {
      this.logger.error(`Failed to send bootstrap to ${connection.id}:`, error);
    }
  }

  /**
   * Send a message to a single connection
   */
  private sendToConnection(
    connection: SSEConnection,
    message: SSEMessage,
  ): boolean {
    try {
      const eventId = ++this.eventId;
      const data = JSON.stringify(message);

      connection.response.write(`id: ${eventId}\n`);
      connection.response.write(`event: ${message.type}\n`);
      connection.response.write(`data: ${data}\n\n`);

      return true;
    } catch (error) {
      this.logger.warn(`Failed to send to connection ${connection.id}:`, error);
      return false;
    }
  }

  /**
   * Broadcast to all connections for an environment
   */
  private broadcastToEnvironment(
    projectId: string,
    envId: string,
    message: SSEMessage,
  ): void {
    const envKey = `${projectId}:${envId}`;
    const envConnections = this.connections.get(envKey);

    if (!envConnections || envConnections.size === 0) {
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const connection of envConnections.values()) {
      if (this.sendToConnection(connection, message)) {
        successCount++;
      } else {
        failCount++;
      }
    }

    this.logger.debug(
      `Broadcast to ${envKey}: ${successCount} success, ${failCount} failed`,
    );
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Handle flag update from Redis
   */
  private handleFlagUpdate(messageStr: string): void {
    try {
      const event = JSON.parse(messageStr);
      const { type, projectId, envId, flagKey, flagId, version, timestamp } =
        event;

      if (!projectId || !envId) {
        return;
      }

      // Determine SSE message type
      let sseType: SSEMessageType;
      switch (type) {
        case 'flag.created':
          sseType = SSEMessageType.FLAG_CREATED;
          break;
        case 'flag.updated':
        case 'flag.state_changed':
          sseType = SSEMessageType.FLAG_UPDATED;
          break;
        case 'flag.deleted':
          sseType = SSEMessageType.FLAG_DELETED;
          break;
        default:
          sseType = SSEMessageType.FLAG_UPDATED;
      }

      // Broadcast to all connections for this environment
      this.broadcastToEnvironment(projectId, envId, {
        type: sseType,
        data: {
          flagKey,
          flagId,
          version,
        },
        timestamp: timestamp || new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn('Failed to handle flag update:', error);
    }
  }

  // ==========================================================================
  // HEARTBEAT
  // ==========================================================================

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * Send heartbeat to all connections
   */
  private sendHeartbeat(): void {
    const heartbeatMessage: SSEMessage = {
      type: SSEMessageType.HEARTBEAT,
      data: { timestamp: Date.now() },
      timestamp: new Date().toISOString(),
    };

    for (const envConnections of this.connections.values()) {
      for (const connection of envConnections.values()) {
        this.sendToConnection(connection, heartbeatMessage);
      }
    }
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  /**
   * Get connection statistics
   */
  getStats() {
    let totalConnections = 0;
    const byEnvironment: Record<string, number> = {};

    for (const [envKey, connections] of this.connections.entries()) {
      byEnvironment[envKey] = connections.size;
      totalConnections += connections.size;
    }

    return {
      totalConnections,
      byEnvironment,
      byProject: Object.fromEntries(this.connectionCounts),
    };
  }
}
