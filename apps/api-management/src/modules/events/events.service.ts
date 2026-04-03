// src/modules/events/events.service.ts
// Service de publication d'événements (EventBridge en prod, Redis en dev)
// Aligné avec les variables d'environnement du compute-stack.ts CDK

import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectRole } from '@prisma/client';
import {
  EVENT_SOURCES,
  EVENT_TYPES,
  REDIS_CHANNELS,
  nowISO,
} from '@repo/shared';

import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';

// =============================================================================
// Event Payload Types (with index signature for Record<string, unknown> compatibility)
// =============================================================================

export interface FlagEventPayload {
  projectId: string;
  envId: string;
  flagId: string;
  flagKey: string;
  version?: number;
  changedBy?: string;
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
}

export interface MemberInvitedPayload {
  projectId: string;
  projectName: string;
  invitationId: string;
  email: string;
  role: ProjectRole;
  token: string;
  invitedBy: string;
  inviterName: string;
  inviterEmail: string;
  expiresAt: Date;
  isNewUser: boolean;
  isResend?: boolean;
  [key: string]: unknown;
}

export interface MemberRemovedPayload {
  projectId: string;
  userId: string;
  userEmail: string;
  removedBy: string;
  [key: string]: unknown;
}

export interface EnvironmentEventPayload {
  projectId: string;
  envId: string;
  envName: string;
  changedBy?: string;
  [key: string]: unknown;
}

// Type for generic event payload
type EventPayload = Record<string, unknown>;

// =============================================================================
// EventsService
// =============================================================================

@Injectable()
export class EventsService implements OnModuleInit {
  private readonly logger = new Logger(EventsService.name);

  // Clients AWS (initialisés en prod uniquement)
  private eventBridgeClient: EventBridgeClient | null = null;
  private snsClient: SNSClient | null = null;

  // Configuration (lue depuis les variables d'environnement ECS)
  // Variables: EVENT_BUS_NAME, FLAG_TOPIC_ARN, AWS_REGION, NODE_ENV
  private readonly isProduction: boolean;
  private readonly region: string;
  private readonly eventBusName: string;
  private readonly flagTopicArn: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly emailService: EmailService,
  ) {
    // Lecture des variables d'environnement via ConfigService
    this.isProduction =
      this.configService.get<string>('nodeEnv') === 'production';
    this.region = this.configService.get<string>('aws.region') || 'us-east-1';
    this.eventBusName =
      this.configService.get<string>('messaging.eventBusName') ||
      'feature-flags-bus';
    this.flagTopicArn = this.configService.get<string>(
      'messaging.flagTopicArn',
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit(): Promise<void> {
    if (this.isProduction) {
      try {
        // Initialisation des clients AWS en production
        this.eventBridgeClient = new EventBridgeClient({ region: this.region });
        this.snsClient = new SNSClient({ region: this.region });

        this.logger.log(
          `📡 EventBridge client initialized (bus: ${this.eventBusName}, region: ${this.region})`,
        );

        if (this.flagTopicArn) {
          this.logger.log(
            `📡 SNS client initialized (topic: ${this.flagTopicArn})`,
          );
        }
      } catch (error) {
        this.logger.error(
          '❌ Failed to initialize AWS messaging clients',
          error,
        );
      }
    } else {
      this.logger.log('📡 Events will be published to Redis (dev mode)');
    }
  }

  // ===========================================================================
  // FLAG EVENTS
  // ===========================================================================

  async emitFlagCreated(payload: FlagEventPayload): Promise<void> {
    await this.emit(EVENT_TYPES.FLAG_CREATED, payload, 'management.flags');
    await this.publishToSNS(EVENT_TYPES.FLAG_CREATED, payload);
    await this.publishToRedisForSSE(payload);
  }

  async emitFlagUpdated(payload: FlagEventPayload): Promise<void> {
    await this.emit(EVENT_TYPES.FLAG_UPDATED, payload, 'management.flags');
    await this.publishToSNS(EVENT_TYPES.FLAG_UPDATED, payload);
    await this.publishToRedisForSSE(payload);
  }

  async emitFlagStateChanged(payload: FlagEventPayload): Promise<void> {
    await this.emit(
      EVENT_TYPES.FLAG_STATE_CHANGED,
      payload,
      'management.flags',
    );
    await this.publishToSNS(EVENT_TYPES.FLAG_STATE_CHANGED, payload);
    await this.publishToRedisForSSE(payload);
  }

  async emitFlagDeleted(payload: FlagEventPayload): Promise<void> {
    await this.emit(EVENT_TYPES.FLAG_DELETED, payload, 'management.flags');
    await this.publishToSNS(EVENT_TYPES.FLAG_DELETED, payload);
    await this.publishToRedisForSSE(payload);
  }

  // ===========================================================================
  // ENVIRONMENT EVENTS
  // ===========================================================================

  async emitEnvironmentCreated(
    payload: EnvironmentEventPayload,
  ): Promise<void> {
    await this.emit(
      EVENT_TYPES.ENVIRONMENT_CREATED,
      payload,
      'management.environments',
    );
  }

  async emitEnvironmentUpdated(
    payload: EnvironmentEventPayload,
  ): Promise<void> {
    await this.emit(
      EVENT_TYPES.ENVIRONMENT_UPDATED,
      payload,
      'management.environments',
    );
  }

  async emitApiKeyRotated(payload: EnvironmentEventPayload): Promise<void> {
    await this.emit(
      EVENT_TYPES.API_KEY_ROTATED,
      payload,
      'management.environments',
    );

    // Invalider le cache de l'API key via Redis
    await this.redis.publish(REDIS_CHANNELS.CACHE_INVALIDATION, {
      type: 'api_key_rotated',
      envId: payload.envId,
    });
  }

  // ===========================================================================
  // MEMBER EVENTS (with Email Integration)
  // ===========================================================================

  /**
   * Émet l'événement member.invited ET envoie l'email d'invitation
   */
  async emitMemberInvited(payload: MemberInvitedPayload): Promise<void> {
    // 1. Envoi de l'email immédiatement (ne pas attendre le traitement de l'événement)
    const emailSent = await this.emailService.sendInvitationEmail({
      projectName: payload.projectName,
      inviterName: payload.inviterName,
      inviterEmail: payload.inviterEmail,
      role: payload.role,
      token: payload.token,
      recipientEmail: payload.email,
      isNewUser: payload.isNewUser,
    });

    if (!emailSent) {
      this.logger.warn(
        `⚠️ Invitation email failed for ${payload.email}, but invitation record was created`,
      );
    }

    // 2. Émettre l'événement pour audit/analytics (SANS données sensibles)
    const auditPayload: EventPayload = {
      projectId: payload.projectId,
      invitationId: payload.invitationId,
      email: payload.email,
      role: payload.role,
      invitedBy: payload.invitedBy,
      isNewUser: payload.isNewUser,
      isResend: payload.isResend || false,
      // Note: temporaryPassword n'est PAS inclus dans l'événement (sécurité)
    };

    await this.emit(
      EVENT_TYPES.MEMBER_INVITED,
      auditPayload,
      'management.projects',
    );
  }

  /**
   * Émet l'événement member.removed
   */
  async emitMemberRemoved(payload: MemberRemovedPayload): Promise<void> {
    const eventPayload: EventPayload = {
      projectId: payload.projectId,
      userId: payload.userId,
      userEmail: payload.userEmail,
      removedBy: payload.removedBy,
    };

    await this.emit(
      EVENT_TYPES.MEMBER_REMOVED,
      eventPayload,
      'management.projects',
    );
  }

  // ===========================================================================
  // CORE EMIT FUNCTIONS
  // ===========================================================================

  /**
   * Fonction principale d'émission d'événements
   * - En production: EventBridge
   * - En développement: Redis Pub/Sub
   */
  private async emit(
    eventType: string,
    payload: EventPayload,
    source: string = EVENT_SOURCES.MANAGEMENT_API,
  ): Promise<void> {
    const event: EventPayload = {
      type: eventType,
      timestamp: nowISO(),
      ...payload,
    };

    if (this.isProduction && this.eventBridgeClient) {
      await this.emitToEventBridge(eventType, event, source);
    } else {
      await this.emitToRedis(eventType, event);
    }
  }

  /**
   * Émettre vers EventBridge (production)
   */
  private async emitToEventBridge(
    eventType: string,
    payload: EventPayload,
    source: string,
  ): Promise<void> {
    if (!this.eventBridgeClient) {
      this.logger.warn('EventBridge client not initialized, skipping event');
      return;
    }

    try {
      const command = new PutEventsCommand({
        Entries: [
          {
            EventBusName: this.eventBusName,
            Source: source,
            DetailType: eventType,
            Detail: JSON.stringify(payload),
            Time: new Date(),
          },
        ],
      });

      const response = await this.eventBridgeClient.send(command);

      if (response.FailedEntryCount && response.FailedEntryCount > 0) {
        const failures = response.Entries?.filter((e) => !!e.ErrorCode);

        this.logger.error('❌ Failed to send event(s) to EventBridge', {
          eventType,
          failures,
        });
      } else {
        this.logger.debug(`📤 Event sent to EventBridge: ${eventType}`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to emit event to EventBridge: ${eventType}`,
        error,
      );
    }
  }

  /**
   * Émettre vers Redis Pub/Sub (développement)
   */
  private async emitToRedis(
    eventType: string,
    payload: EventPayload,
  ): Promise<void> {
    if (!this.redis.isReady()) {
      // En dev sans Redis, on log simplement l'événement
      this.logger.debug(`📤 [NO REDIS] Event logged: ${eventType}`, payload);
      return;
    }

    try {
      // Déterminer le channel selon le type d'événement
      let channel: string = REDIS_CHANNELS.FLAG_UPDATES;
      if (eventType.startsWith('environment.')) {
        channel = REDIS_CHANNELS.ENV_UPDATES;
      }

      await this.redis.publish(channel, payload);
      this.logger.debug(
        `📤 Event published to Redis: ${eventType} on ${channel}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to emit event to Redis: ${eventType}`,
        error,
      );
    }
  }

  /**
   * Publier vers SNS Topic (pour fan-out vers SQS queues en production)
   */
  private async publishToSNS(
    eventType: string,
    payload: EventPayload,
  ): Promise<void> {
    if (!this.isProduction || !this.snsClient || !this.flagTopicArn) {
      return;
    }

    try {
      const message: EventPayload = {
        type: eventType,
        timestamp: nowISO(),
        ...payload,
      };

      const command = new PublishCommand({
        TopicArn: this.flagTopicArn,
        Message: JSON.stringify(message),
        MessageAttributes: {
          eventType: {
            DataType: 'String',
            StringValue: eventType,
          },
          projectId: {
            DataType: 'String',
            StringValue: String(payload.projectId || 'unknown'),
          },
        },
      });

      await this.snsClient.send(command);
      this.logger.debug(`📤 Event published to SNS: ${eventType}`);
    } catch (error) {
      this.logger.error(`❌ Failed to publish to SNS: ${eventType}`, error);
    }
  }

  /**
   * Publier vers Redis pour les subscribers SSE (api-read)
   * Nécessaire en DEV et PROD pour les mises à jour temps réel
   */
  private async publishToRedisForSSE(payload: FlagEventPayload): Promise<void> {
    if (!this.redis.isReady()) return;

    try {
      const ssePayload: EventPayload = {
        type: 'flag_update',
        projectId: payload.projectId,
        envId: payload.envId,
        flagId: payload.flagId,
        flagKey: payload.flagKey,
        version: payload.version,
        timestamp: nowISO(),
      };

      await this.redis.publish(REDIS_CHANNELS.FLAG_UPDATES, ssePayload);
    } catch (error) {
      this.logger.error(
        '❌ Failed to publish flag update to Redis for SSE',
        error,
      );
    }
  }

  // ===========================================================================
  // BATCH EMIT (pour opérations en masse)
  // ===========================================================================

  async emitBatch(
    events: Array<{ type: string; payload: EventPayload; source?: string }>,
  ): Promise<void> {
    if (!this.isProduction || !this.eventBridgeClient) {
      // En dev, émettre un par un vers Redis
      for (const event of events) {
        await this.emit(event.type, event.payload, event.source);
      }
      return;
    }

    // En prod, batch vers EventBridge (max 10 par requête)
    const batches = this.chunk(events, 10);

    for (const batch of batches) {
      try {
        const command = new PutEventsCommand({
          Entries: batch.map((event) => ({
            EventBusName: this.eventBusName,
            Source: event.source || EVENT_SOURCES.MANAGEMENT_API,
            DetailType: event.type,
            Detail: JSON.stringify({
              type: event.type,
              timestamp: nowISO(),
              ...event.payload,
            }),
            Time: new Date(),
          })),
        });

        const response = await this.eventBridgeClient.send(command);

        if (response.FailedEntryCount && response.FailedEntryCount > 0) {
          this.logger.error('⚠️ Some events in batch failed', {
            failedCount: response.FailedEntryCount,
          });
        }
      } catch (error) {
        this.logger.error('❌ Failed to send batch to EventBridge', error);
      }
    }
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
