// apps/api-read/src/modules/events/events.consumer.ts
// Consumer d'événements pour invalidation de cache
//
// ARCHITECTURE:
// ┌─────────────────────────────────────────────────────────────────────────┐
// │                         EventsConsumer                                  │
// │                                                                         │
// │   PRODUCTION (SQS)                    DÉVELOPPEMENT (Redis)            │
// │   ────────────────                    ─────────────────────            │
// │                                                                         │
// │   SNS (api-management)                Redis Pub/Sub (api-management)   │
// │         │                                     │                        │
// │         ▼                                     ▼                        │
// │   ┌───────────┐                        ┌───────────┐                   │
// │   │ ReadQueue │                        │ Subscriber│                   │
// │   │   (SQS)   │                        │  Channel  │                   │
// │   └─────┬─────┘                        └─────┬─────┘                   │
// │         │                                     │                        │
// │         └─────────────┬───────────────────────┘                        │
// │                       │                                                │
// │                       ▼                                                │
// │               handleFlagEvent()                                        │
// │                       │                                                │
// │                       ▼                                                │
// │               CacheService.invalidate()                                │
// │                       │                                                │
// │                       ▼                                                │
// │               SSEService.broadcast()                                   │
// │                                                                         │
// └─────────────────────────────────────────────────────────────────────────┘

import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SSEMessageType } from '@repo/shared';

import { CacheService } from '../cache/cache.service';
import { SSEService } from '../sse/sse.service';

// import type { Message } from "@aws-sdk/client-sqs/dist-types/models/models_0";

// Types d'événements attendus
interface FlagEvent {
  type: string;
  projectId: string;
  envId: string;
  flagId?: string;
  flagKey?: string;
  version?: number;
  timestamp?: string;
  // Pour les rotations de clé API
  apiKeyHash?: string;
  oldApiKeyHash?: string;
}

@Injectable()
export class EventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsConsumer.name);

  // SQS client (production)
  private sqsClient?: SQSClient;
  private sqsQueueUrl?: string;
  private sqsPollingActive = false;
  private sqsPollingInterval: number;

  // Mode
  private isProduction: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly cache: CacheService,
    private readonly sse: SSEService,
  ) {
    this.isProduction =
      this.configService.get<string>('nodeEnv') === 'production';
    this.sqsQueueUrl = this.configService.get<string>('messaging.readQueueUrl');
    this.sqsPollingInterval =
      this.configService.get<number>('messaging.sqsPollingInterval') || 1000;
  }

  async onModuleInit() {
    if (this.isProduction && this.sqsQueueUrl) {
      // Production: Utiliser SQS
      const region =
        this.configService.get<string>('aws.region') || 'us-east-1';
      this.sqsClient = new SQSClient({ region });
      this.startSQSPolling();
      this.logger.log(`Events consumer initialized (SQS: ${this.sqsQueueUrl})`);
    } else {
      // Développement: Redis Pub/Sub est géré par CacheService
      // Rien à faire ici, les événements arrivent via CacheService.handleInvalidationMessage()
      this.logger.log(
        'Events consumer initialized (Redis Pub/Sub via CacheService)',
      );
    }
  }

  async onModuleDestroy() {
    this.sqsPollingActive = false;
    this.sqsClient?.destroy();
  }

  // ==========================================================================
  // SQS POLLING (PRODUCTION)
  // ==========================================================================

  /**
   * Démarre le polling SQS pour recevoir les événements
   */
  private startSQSPolling(): void {
    this.sqsPollingActive = true;
    void this.pollSQS();
  }

  /**
   * Poll SQS de manière récursive
   */
  private async pollSQS(): Promise<void> {
    if (!this.sqsPollingActive || !this.sqsClient || !this.sqsQueueUrl) {
      return;
    }

    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.sqsQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20, // Long polling
        MessageAttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);

      if (response.Messages && response.Messages.length > 0) {
        await this.processMessages(response.Messages);
      }
    } catch (error) {
      this.logger.error('SQS polling error:', error);
      // Attendre avant de réessayer en cas d'erreur
      await this.sleep(5000);
    }

    // Continuer le polling
    if (this.sqsPollingActive) {
      setTimeout(() => this.pollSQS(), this.sqsPollingInterval);
    }
  }

  /**
   * Traite un batch de messages SQS
   */
  private async processMessages(messages: Message[]): Promise<void> {
    for (const message of messages) {
      try {
        // Parser le message SNS > SQS
        const body = JSON.parse(message.Body || '{}');

        // Les messages SNS sont wrappés dans un format spécifique
        const event: FlagEvent = body.Message ? JSON.parse(body.Message) : body;

        await this.handleFlagEvent(event);

        // Supprimer le message après traitement réussi
        await this.deleteMessage(message.ReceiptHandle!);
      } catch (error) {
        this.logger.error(
          `Failed to process SQS message: ${message.MessageId}`,
          error,
        );
        // Le message sera re-délivré après le visibility timeout
      }
    }
  }

  /**
   * Supprime un message de la queue après traitement
   */
  private async deleteMessage(receiptHandle: string): Promise<void> {
    if (!this.sqsClient || !this.sqsQueueUrl) return;

    try {
      await this.sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: this.sqsQueueUrl,
          ReceiptHandle: receiptHandle,
        }),
      );
    } catch (error) {
      this.logger.warn('Failed to delete SQS message:', error);
    }
  }

  // ==========================================================================
  // EVENT HANDLING
  // ==========================================================================

  /**
   * Gère un événement de flag (appelé par SQS ou exposé publiquement)
   */
  async handleFlagEvent(event: FlagEvent): Promise<void> {
    const {
      type,
      projectId,
      envId,
      flagKey,
      flagId,
      version,
      apiKeyHash,
      oldApiKeyHash,
    } = event;

    this.logger.debug(
      `Processing event: ${type} for ${flagKey || 'env'} in ${envId || 'project'}`,
    );

    try {
      switch (type) {
        // ────────────────────────────────────────────────────────────────────
        // FLAG EVENTS
        // ────────────────────────────────────────────────────────────────────
        case 'flag.created':
          // Invalider le cache "all flags" pour qu'il soit reconstruit avec le nouveau flag
          if (projectId && envId) {
            await this.cache.invalidateEnvironment(projectId, envId);
            this.broadcastToSSE(projectId, envId, SSEMessageType.FLAG_CREATED, {
              flagKey,
              flagId,
              version,
            });
          }
          break;

        case 'flag.updated':
        case 'flag.state_changed':
          // Invalider le cache du flag spécifique
          if (projectId && envId && flagKey) {
            await this.cache.invalidateFlag(projectId, envId, flagKey);
            this.broadcastToSSE(projectId, envId, SSEMessageType.FLAG_UPDATED, {
              flagKey,
              flagId,
              version,
            });
          }
          break;

        case 'flag.deleted':
          // Invalider le cache du flag et le cache "all flags"
          if (projectId && envId && flagKey) {
            await this.cache.invalidateFlag(projectId, envId, flagKey);
            this.broadcastToSSE(projectId, envId, SSEMessageType.FLAG_DELETED, {
              flagKey,
              flagId,
            });
          }
          break;

        // ────────────────────────────────────────────────────────────────────
        // API KEY EVENTS
        // ────────────────────────────────────────────────────────────────────
        case 'api_key.rotated':
          // Invalider le cache de l'ancienne clé API
          if (oldApiKeyHash) {
            await this.cache.invalidateApiKey(oldApiKeyHash);
          }
          // Aussi invalider la nouvelle si elle était pré-cachée (edge case)
          if (apiKeyHash) {
            await this.cache.invalidateApiKey(apiKeyHash);
          }
          break;

        // ────────────────────────────────────────────────────────────────────
        // ENVIRONMENT EVENTS
        // ────────────────────────────────────────────────────────────────────
        case 'environment.updated':
        case 'environment.deleted':
          // Invalider tout le cache de l'environnement
          if (projectId && envId) {
            await this.cache.invalidateEnvironment(projectId, envId);
          }
          break;

        default:
          this.logger.debug(`Unhandled event type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Error handling event ${type}:`, error);
      throw error; // Re-throw pour que SQS puisse retry
    }
  }

  // ==========================================================================
  // SSE BROADCASTING
  // ==========================================================================

  /**
   * Broadcast un événement aux clients SSE connectés
   */
  private broadcastToSSE(
    projectId: string,
    envId: string,
    type: SSEMessageType,
    _data: Record<string, unknown>,
  ): void {
    try {
      // SSEService gère le broadcast interne
      // On publie sur Redis pour que toutes les instances api-read reçoivent
      // (SSEService écoute déjà REDIS_CHANNELS.FLAG_UPDATES)
      // Donc pas besoin de faire quoi que ce soit ici, le message original
      // a déjà été publié par api-management
      this.logger.debug(`SSE broadcast: ${type} to ${projectId}:${envId}`);
    } catch (error) {
      this.logger.warn('Failed to broadcast to SSE:', error);
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // PUBLIC API (pour tests ou appels manuels)
  // ==========================================================================

  /**
   * Force l'invalidation du cache pour un flag
   * Utile pour les tests ou la réconciliation manuelle
   */
  async forceInvalidate(
    projectId: string,
    envId: string,
    flagKey?: string,
  ): Promise<void> {
    if (flagKey) {
      await this.cache.invalidateFlag(projectId, envId, flagKey);
    } else {
      await this.cache.invalidateEnvironment(projectId, envId);
    }
  }

  /**
   * Retourne les statistiques du consumer
   */
  getStats() {
    return {
      mode: this.isProduction ? 'SQS' : 'Redis',
      sqsQueueUrl: this.sqsQueueUrl || 'N/A',
      sqsPollingActive: this.sqsPollingActive,
    };
  }
}
