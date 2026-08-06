#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

// Core infrastructure
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { AuthStack } from '../lib/auth-stack';
import { MessagingStack } from '../lib/messaging-stack';
import { ECRStack } from '../lib/ecr-stack';
import { ComputeStack } from '../lib/compute-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { EmailStack } from '../lib/email-stack';

// Frontends (à décommenter quand les apps seront prêtes)
// import { DashboardStack } from '../lib/dashboard-stack';
// import { DocumentationStack } from '../lib/documentation-stack';

// CI/CD (optionnel)
// import { PipelineStack } from '../lib/pipeline-stack';

// -------------------------------------------------------
// App & Environment Configuration
// -------------------------------------------------------
const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Configuration pour réduire les coûts (mode développement)
const config = {
  // Email pour les alertes et SES
  alarmEmail: process.env.ALARM_EMAIL || 'diderotsielinou@gmail.com',

  isProduction: process.env.NODE_ENV === 'production',
  dashboardUrl: 'http://localhost:3000',

  // Domaine (optionnel - à configurer plus tard)
  domainName: process.env.DOMAIN_NAME,
  certificateArn: process.env.CERTIFICATE_ARN,
  hostedZoneId: process.env.HOSTED_ZONE_ID,
};

// -------------------------------------------------------
// 1. Network Stack
// -------------------------------------------------------
const networkStack = new NetworkStack(app, 'FeatureFlagsNetworkStack', {
  env,
  description: 'LaunchLayer - VPC and Network Infrastructure',
  isProduction: config.isProduction,
});

// -------------------------------------------------------
// 2. Database Stack (PostgreSQL + Redis)
// -------------------------------------------------------
const databaseStack = new DatabaseStack(app, 'FeatureFlagsDatabaseStack', {
  env,
  description: 'LaunchLayer - PostgreSQL and Redis',
  vpc: networkStack.vpc,
  databaseSecurityGroup: networkStack.databaseSecurityGroup,
  cacheSecurityGroup: networkStack.cacheSecurityGroup,
  isProduction: config.isProduction,
});
databaseStack.addDependency(networkStack);

// -------------------------------------------------------
// 3. Authentication Stack (Cognito)
// -------------------------------------------------------
const authStack = new AuthStack(app, 'FeatureFlagsAuthStack', {
  env,
  description: 'LaunchLayer - Cognito Authentication',
});

// -------------------------------------------------------
// 4. Email Stack (SES)
// -------------------------------------------------------
const emailStack = new EmailStack(app, 'FeatureFlagsEmailStack', {
  env,
  description: 'LaunchLayer - Amazon SES Email Service',
  senderEmail: config.alarmEmail,
  // Domaine optionnel (à configurer plus tard)
  // domainName: config.domainName,
});

// -------------------------------------------------------
// 5. Messaging Stack (EventBridge, SNS, SQS)
// -------------------------------------------------------
const messagingStack = new MessagingStack(app, 'FeatureFlagsMessagingStack', {
  env,
  description: 'LaunchLayer - EventBridge, SNS, SQS',
});
messagingStack.addDependency(networkStack);

// -------------------------------------------------------
// 6. ECR Stack (Docker Repositories)
// Déployée AVANT ComputeStack pour permettre le push des images
// -------------------------------------------------------
const ecrStack = new ECRStack(app, 'FeatureFlagsECRStack', {
  env,
  description: 'LaunchLayer - ECR Docker Repositories',
});

// -------------------------------------------------------
// 7. Compute Stack (ECS Fargate Services)
// -------------------------------------------------------
const computeStack = new ComputeStack(app, 'FeatureFlagsComputeStack', {
  env,
  description: 'LaunchLayer - ECS Fargate Services',

  // Network
  vpc: networkStack.vpc,
  applicationSecurityGroup: networkStack.applicationSecurityGroup,
  albSecurityGroup: networkStack.albSecurityGroup,

  // Database
  dbSecret: databaseStack.dbSecret,
  dbEndpoint: databaseStack.dbInstance.dbInstanceEndpointAddress,
  redisEndpoint: databaseStack.redisCluster.attrPrimaryEndPointAddress,

  // Auth
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,

  // Messaging
  flagTopicArn: messagingStack.flagTopic.topicArn,
  readQueueArn: messagingStack.readQueue.queueArn,
  readQueueUrl: messagingStack.readQueue.queueUrl,
  eventBusName: messagingStack.eventBus.eventBusName,

  // ECR
  managementEcr: ecrStack.managementRepo,
  readEcr: ecrStack.readRepo,

  // Email (SES)
  sesIdentityArn: emailStack.emailIdentityArn,
  senderEmail: config.alarmEmail,

  // App URLs (à configurer quand vous aurez un domaine)
  dashboardUrl: config.dashboardUrl ? `https://app.${config.domainName}` : undefined,
  // docsUrl: config.domainName ? `https://docs.${config.domainName}` : undefined,

  // Configuration
  isProduction: config.isProduction,
});

computeStack.addDependency(networkStack);
computeStack.addDependency(databaseStack);
computeStack.addDependency(authStack);
computeStack.addDependency(messagingStack);
computeStack.addDependency(ecrStack);
computeStack.addDependency(emailStack);

// -------------------------------------------------------
// 8. Monitoring Stack (CloudWatch)
// -------------------------------------------------------
const monitoringStack = new MonitoringStack(app, 'FeatureFlagsMonitoringStack', {
  env,
  description: 'LaunchLayer - CloudWatch Monitoring',
  managementService: computeStack.managementService,
  readService: computeStack.readService,
  alb: computeStack.alb,
  alarmEmail: config.alarmEmail,
});
monitoringStack.addDependency(computeStack);

// -------------------------------------------------------
// 9. Dashboard Stack (Next.js → S3 + CloudFront)
// À décommenter quand le dashboard sera prêt
// -------------------------------------------------------
// const dashboardStack = new DashboardStack(app, 'FeatureFlagsDashboardStack', {
//   env,
//   description: 'LaunchLayer - Dashboard Frontend',
//   apiManagementBaseUrl: `http://${computeStack.alb.loadBalancerDnsName}`,
//   // Domaine optionnel
//   // domainName: config.domainName ? `dashboard.${config.domainName}` : undefined,
//   // certificateArn: config.certificateArn,
//   // hostedZoneId: config.hostedZoneId,
// });
// dashboardStack.addDependency(computeStack);

// -------------------------------------------------------
// 10. Documentation Stack (Docusaurus → S3 + CloudFront)
// À décommenter quand la documentation sera prête
// -------------------------------------------------------
// const documentationStack = new DocumentationStack(app, 'FeatureFlagsDocumentationStack', {
//   env,
//   description: 'LaunchLayer - Documentation',
//   // domainName: config.domainName ? `docs.${config.domainName}` : undefined,
//   // certificateArn: config.certificateArn,
//   // hostedZoneId: config.hostedZoneId,
// });

// -------------------------------------------------------
// Tags for all resources
// -------------------------------------------------------
cdk.Tags.of(app).add('Project', 'FeatureFlags');
cdk.Tags.of(app).add('Application', 'LaunchLayer');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Environment', config.isProduction ? 'production' : 'development');
cdk.Tags.of(app).add('CostCenter', 'FeatureFlags');

// -------------------------------------------------------
// Deployment Order Summary
// -------------------------------------------------------
/*
ORDRE DE DÉPLOIEMENT RECOMMANDÉ:

Phase 1 - Infrastructure de base (sans images Docker):
  1. cdk deploy FeatureFlagsNetworkStack
  2. cdk deploy FeatureFlagsDatabaseStack
  3. cdk deploy FeatureFlagsAuthStack
  4. cdk deploy FeatureFlagsEmailStack
  5. cdk deploy FeatureFlagsMessagingStack
  6. cdk deploy FeatureFlagsECRStack

Phase 2 - Build et Push des images Docker:
  ./scripts/build-and-push.sh

Phase 3 - Services ECS:
  7. cdk deploy FeatureFlagsComputeStack
  8. cdk deploy FeatureFlagsMonitoringStack

Commande pour tout déployer (après le push des images):
  cdk deploy --all --require-approval never

Pour détruire:
  cdk destroy --all
*/
