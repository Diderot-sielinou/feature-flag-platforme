#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

// Core infrastructure
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { AuthStack } from '../lib/auth-stack';
import { MessagingStack } from '../lib/messaging-stack';
import { ComputeStack } from '../lib/compute-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

// Frontends
import { DashboardStack } from '../lib/dashboard-stack';
import { DocumentationStack } from '../lib/documentation-stack';

// CI/CD
import { PipelineStack } from '../lib/pipeline-stack';

// -------------------------------------------------------
// App & Environment
// -------------------------------------------------------
const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// -------------------------------------------------------
// 1. Network
// -------------------------------------------------------
const networkStack = new NetworkStack(app, 'FeatureFlagsNetworkStack', { env });

// -------------------------------------------------------
// 2. Database + Redis
// -------------------------------------------------------
const databaseStack = new DatabaseStack(app, 'FeatureFlagsDatabaseStack', {
  env,
  vpc: networkStack.vpc,
  databaseSecurityGroup: networkStack.databaseSecurityGroup,
  cacheSecurityGroup: networkStack.cacheSecurityGroup,
});
databaseStack.addDependency(networkStack);

// -------------------------------------------------------
// 3. Authentication
// -------------------------------------------------------
const authStack = new AuthStack(app, 'FeatureFlagsAuthStack', { env });

// -------------------------------------------------------
// 4. Messaging (SNS, SQS, EventBridge)
// -------------------------------------------------------
const messagingStack = new MessagingStack(app, 'FeatureFlagsMessagingStack', {
  env,
});
messagingStack.addDependency(networkStack);

// -------------------------------------------------------
// 5. Compute (ECS Fargate services)
// -------------------------------------------------------
const computeStack = new ComputeStack(app, 'FeatureFlagsComputeStack', {
  env,
  vpc: networkStack.vpc,
  applicationSecurityGroup: networkStack.applicationSecurityGroup,

  dbSecret: databaseStack.dbSecret,
  dbEndpoint: databaseStack.dbInstance.dbInstanceEndpointAddress,
  redisEndpoint: databaseStack.redisCluster.attrPrimaryEndPointAddress,

  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,

  flagTopicArn: messagingStack.flagTopic.topicArn,
  readQueueArn: messagingStack.readQueue.queueArn,
  readQueueUrl: messagingStack.readQueue.queueUrl,
  eventBusName: messagingStack.eventBus.eventBusName,
});

computeStack.addDependency(databaseStack);
computeStack.addDependency(authStack);
computeStack.addDependency(messagingStack);

// -------------------------------------------------------
// 6. Dashboard (Next.js → S3 + CloudFront)
// -------------------------------------------------------
const dashboardStack = new DashboardStack(app, 'FeatureFlagsDashboardStack', {
  env,
  apiManagementBaseUrl: `https://${computeStack.alb.loadBalancerDnsName}`,
  // domainName: "dashboard.yourcompany.com",
  // certificateArn: "arn:aws:acm:…",
  // hostedZoneId: "Zxxxx",
});

dashboardStack.addDependency(computeStack);

// -------------------------------------------------------
// 7. Documentation (Docusaurus → S3 + CloudFront)
// -------------------------------------------------------
const documentationStack = new DocumentationStack(app, 'FeatureFlagsDocumentationStack', {
  env,
  // domainName: "docs.yourcompany.com",
  // certificateArn: "arn:aws:acm:…",
  // hostedZoneId: "Zxxxx",
});

// -------------------------------------------------------
// 8. Monitoring (CloudWatch alarms, dashboards)
// -------------------------------------------------------
const monitoringStack = new MonitoringStack(app, 'FeatureFlagsMonitoringStack', {
  env,
  managementService: computeStack.managementService,
  readService: computeStack.readService,
  alb: computeStack.alb,
  alarmEmail: 'diderotsielinou@gmail.com',
});

monitoringStack.addDependency(computeStack);

// -------------------------------------------------------
// 9. CI/CD Pipeline (GitHub → ECR → ECS Blue/Green)
// -------------------------------------------------------
const pipelineStack = new PipelineStack(app, 'FeatureFlagsPipelineStack', {
  env,
  repositoryOwner: 'fonou-diderot',
  repositoryName: 'feature-flags-platform',
  branch: 'main',
  githubTokenSecretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:github-token-xxxxx', // remplis avec ton ARN
  managementEcr: computeStack.managementEcr,
  readEcr: computeStack.readEcr,
  managementService: computeStack.managementService,
  readService: computeStack.readService,
});
pipelineStack.addDependency(computeStack);

// -------------------------------------------------------
// Tags for all resources
// -------------------------------------------------------
cdk.Tags.of(app).add('Project', 'FeatureFlags');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
