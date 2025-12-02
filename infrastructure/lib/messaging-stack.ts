import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as targets from 'aws-cdk-lib/aws-events-targets';

/**
 * Stack responsable de la messagerie entre microservices:
 * - EventBridge pour le routage des événements
 * - SNS pour le fan-out des notifications
 * - SQS pour les queues de consommation avec DLQ
 */
export class MessagingStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;
  public readonly flagTopic: sns.Topic;
  public readonly readQueue: sqs.Queue;
  public readonly readDlq: sqs.Queue;
  public readonly analyticsQueue: sqs.Queue;
  public readonly analyticsDlq: sqs.Queue;
  public readonly webhookQueue: sqs.Queue;
  public readonly webhookDlq: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // EventBridge - Bus d'événements central
    // ========================================
    this.eventBus = new events.EventBus(this, 'FeatureFlagsBus', {
      eventBusName: 'feature-flags-bus',
    });

    // ========================================
    // SNS Topic - Fan-out des événements de flags
    // ========================================
    this.flagTopic = new sns.Topic(this, 'FlagTopic', {
      topicName: 'feature-flags-flag-updates',
      displayName: 'Feature Flags - Flag Updates',
    });

    // ========================================
    // SQS Queues avec Dead Letter Queues
    // ========================================

    // --- Read Queue (consommée par api-read pour invalidation cache) ---
    this.readDlq = new sqs.Queue(this, 'ReadDLQ', {
      queueName: 'feature-flags-read-dlq',
      retentionPeriod: cdk.Duration.days(14),
      // Pas de chiffrement pour réduire les coûts en dev
    });

    this.readQueue = new sqs.Queue(this, 'ReadQueue', {
      queueName: 'feature-flags-read-queue',
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(4),
      // Long polling pour réduire les coûts
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        maxReceiveCount: 5,
        queue: this.readDlq,
      },
    });

    // --- Analytics Queue (pour les métriques d'évaluation) ---
    this.analyticsDlq = new sqs.Queue(this, 'AnalyticsDLQ', {
      queueName: 'feature-flags-analytics-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    this.analyticsQueue = new sqs.Queue(this, 'AnalyticsQueue', {
      queueName: 'feature-flags-analytics-queue',
      visibilityTimeout: cdk.Duration.seconds(120),
      retentionPeriod: cdk.Duration.days(7),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        maxReceiveCount: 5,
        queue: this.analyticsDlq,
      },
    });

    // --- Webhook Queue (pour l'envoi des webhooks) ---
    this.webhookDlq = new sqs.Queue(this, 'WebhookDLQ', {
      queueName: 'feature-flags-webhook-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    this.webhookQueue = new sqs.Queue(this, 'WebhookQueue', {
      queueName: 'feature-flags-webhook-queue',
      visibilityTimeout: cdk.Duration.seconds(300), // 5 min pour les retries HTTP
      retentionPeriod: cdk.Duration.days(7),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        maxReceiveCount: 3, // Moins de retries pour les webhooks
        queue: this.webhookDlq,
      },
    });

    // ========================================
    // SNS Subscriptions - Fan-out vers les queues
    // ========================================
    this.flagTopic.addSubscription(
      new subs.SqsSubscription(this.readQueue, {
        rawMessageDelivery: true,
      }),
    );

    this.flagTopic.addSubscription(
      new subs.SqsSubscription(this.analyticsQueue, {
        rawMessageDelivery: true,
      }),
    );

    this.flagTopic.addSubscription(
      new subs.SqsSubscription(this.webhookQueue, {
        rawMessageDelivery: true,
      }),
    );

    // ========================================
    // EventBridge Rules - Routage des événements
    // ========================================

    // Règle: Events de flags → SNS Topic
    new events.Rule(this, 'FlagEventsToSNS', {
      ruleName: 'feature-flags-to-sns',
      description: 'Route flag events to SNS topic for fan-out',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['management.flags'],
        detailType: [
          'flag.created',
          'flag.updated',
          'flag.deleted',
          'flag.toggled',
          'flag.rules_updated',
        ],
      },
      targets: [new targets.SnsTopic(this.flagTopic)],
    });

    // Règle: Events de segments → SNS Topic
    new events.Rule(this, 'SegmentEventsToSNS', {
      ruleName: 'feature-segments-to-sns',
      description: 'Route segment events to SNS topic',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['management.segments'],
        detailType: ['segment.created', 'segment.updated', 'segment.deleted'],
      },
      targets: [new targets.SnsTopic(this.flagTopic)],
    });

    // Règle: Events de projets (pour audit)
    new events.Rule(this, 'ProjectEventsRule', {
      ruleName: 'feature-projects-events',
      description: 'Capture project-level events',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['management.projects'],
        detailType: [
          'project.created',
          'project.updated',
          'project.deleted',
          'member.invited',
          'member.removed',
        ],
      },
      targets: [new targets.SnsTopic(this.flagTopic)],
    });

    // ========================================
    // Archive des événements (optionnel, pour replay)
    // ========================================
    new events.CfnArchive(this, 'EventArchive', {
      archiveName: 'feature-flags-archive',
      description: 'Archive of all feature flag events',
      sourceArn: this.eventBus.eventBusArn,
      eventPattern: {
        source: [{ prefix: 'management.' }],
      },
      retentionDays: 30, // 30 jours de rétention
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      description: 'EventBridge Bus Name',
      exportName: 'FeatureFlagsEventBusName',
    });

    new cdk.CfnOutput(this, 'EventBusArn', {
      value: this.eventBus.eventBusArn,
      description: 'EventBridge Bus ARN',
      exportName: 'FeatureFlagsEventBusArn',
    });

    new cdk.CfnOutput(this, 'FlagTopicArn', {
      value: this.flagTopic.topicArn,
      description: 'SNS Topic ARN for flag updates',
      exportName: 'FeatureFlagsFlagTopicArn',
    });

    new cdk.CfnOutput(this, 'ReadQueueUrl', {
      value: this.readQueue.queueUrl,
      description: 'SQS Queue URL for read service',
      exportName: 'FeatureFlagsReadQueueUrl',
    });

    new cdk.CfnOutput(this, 'ReadQueueArn', {
      value: this.readQueue.queueArn,
      description: 'SQS Queue ARN for read service',
      exportName: 'FeatureFlagsReadQueueArn',
    });

    new cdk.CfnOutput(this, 'AnalyticsQueueUrl', {
      value: this.analyticsQueue.queueUrl,
      description: 'SQS Queue URL for analytics',
      exportName: 'FeatureFlagsAnalyticsQueueUrl',
    });

    new cdk.CfnOutput(this, 'WebhookQueueUrl', {
      value: this.webhookQueue.queueUrl,
      description: 'SQS Queue URL for webhooks',
      exportName: 'FeatureFlagsWebhookQueueUrl',
    });

    new cdk.CfnOutput(this, 'WebhookQueueArn', {
      value: this.webhookQueue.queueArn,
      description: 'SQS Queue ARN for webhooks',
      exportName: 'FeatureFlagsWebhookQueueArn',
    });
  }
}
