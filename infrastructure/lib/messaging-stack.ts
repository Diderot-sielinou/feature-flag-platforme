import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as targets from 'aws-cdk-lib/aws-events-targets';

export interface MessagingStackProps extends cdk.StackProps {}

/**
 * Stack responsible for messaging between microservices :
 * - EventBridge (bus interne)
 * - SNS (fan-out topic)
 * - SQS (queues de consommation)
 */
export class MessagingStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;
  public readonly flagTopic: sns.Topic;
  public readonly readQueue: sqs.Queue;
  public readonly analyticsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: MessagingStackProps) {
    super(scope, id, props);

    //
    // EventBridge Bus
    //
    this.eventBus = new events.EventBus(this, 'FeatureFlagsBus', {
      eventBusName: 'feature-flags-bus',
    });

    //
    //  SNS Topic pour fan-out des évènements de flags
    //
    this.flagTopic = new sns.Topic(this, 'FlagTopic', {
      topicName: 'feature-flags-flag-updates',
      displayName: 'Feature Flags - Flag Updates',
    });

    //
    //  SQS Queues (Read + Analytics) avec DLQs
    //
    const readDlq = new sqs.Queue(this, 'ReadDLQ', {
      queueName: 'feature-flags-read-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    this.readQueue = new sqs.Queue(this, 'ReadQueue', {
      queueName: 'feature-flags-read-queue',
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(4),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        maxReceiveCount: 5,
        queue: readDlq,
      },
    });

    const analyticsDlq = new sqs.Queue(this, 'AnalyticsDLQ', {
      queueName: 'feature-flags-analytics-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    this.analyticsQueue = new sqs.Queue(this, 'AnalyticsQueue', {
      queueName: 'feature-flags-analytics-queue',
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        maxReceiveCount: 5,
        queue: analyticsDlq,
      },
    });

    //
    //  SNS Subscriptions : SNS -> SQS
    //
    this.flagTopic.addSubscription(new subs.SqsSubscription(this.readQueue));
    this.flagTopic.addSubscription(new subs.SqsSubscription(this.analyticsQueue));

    //
    //  EventBridge Rule : route les évènements "management.flags" vers SNS
    //
    new events.Rule(this, 'FlagEventsToSNS', {
      eventBus: this.eventBus,
      eventPattern: {
        source: ['management.flags'],
        detailType: ['flag.created', 'flag.updated', 'flag.deleted'],
      },
      targets: [new targets.SnsTopic(this.flagTopic)],
    });

    //
    //  Permissions types (IAM policy templates)
    //
    const publishPolicy = new iam.PolicyStatement({
      actions: ['sns:Publish', 'events:PutEvents'],
      resources: [this.flagTopic.topicArn, this.eventBus.eventBusArn],
    });

    const consumePolicy = new iam.PolicyStatement({
      actions: [
        'sqs:ReceiveMessage',
        'sqs:DeleteMessage',
        'sqs:GetQueueAttributes',
        'sqs:ChangeMessageVisibility',
      ],
      resources: [this.readQueue.queueArn, this.analyticsQueue.queueArn],
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      exportName: 'FeatureFlagsEventBusName',
    });

    new cdk.CfnOutput(this, 'FlagTopicArn', {
      value: this.flagTopic.topicArn,
      exportName: 'FeatureFlagsFlagTopicArn',
    });

    new cdk.CfnOutput(this, 'ReadQueueUrl', {
      value: this.readQueue.queueUrl,
      exportName: 'FeatureFlagsReadQueueUrl',
    });

    new cdk.CfnOutput(this, 'ReadQueueArn', {
      value: this.readQueue.queueArn,
      exportName: 'FeatureFlagsReadQueueArn',
    });

    new cdk.CfnOutput(this, 'AnalyticsQueueUrl', {
      value: this.analyticsQueue.queueUrl,
      exportName: 'FeatureFlagsAnalyticsQueueUrl',
    });
  }
}
