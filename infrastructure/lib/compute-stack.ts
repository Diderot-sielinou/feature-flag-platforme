import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ComputeStackProps extends cdk.StackProps {
  // Network
  vpc: ec2.Vpc;
  applicationSecurityGroup: ec2.SecurityGroup;
  albSecurityGroup: ec2.SecurityGroup;

  // Database
  dbSecret: secretsmanager.Secret;
  dbEndpoint: string;
  redisEndpoint: string;

  // Auth
  userPoolId: string;
  userPoolClientId: string;

  // Messaging
  flagTopicArn: string;
  readQueueArn: string;
  readQueueUrl: string;
  eventBusName: string;

  // ECR
  managementEcr: ecr.Repository;
  readEcr: ecr.Repository;

  // Email (SES)
  sesIdentityArn: string;
  senderEmail: string;

  // Configuration
  isProduction?: boolean;
}

/**
 * Stack responsable du compute (ECS Fargate):
 * - ECS Cluster
 * - Task Definitions avec configurations optimisées
 * - Fargate Services avec auto-scaling
 * - Application Load Balancer avec routage
 * - Support SSE (Server-Sent Events) optimisé
 */
export class ComputeStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly managementService: ecs.FargateService;
  public readonly readService: ecs.FargateService;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly managementEcr: ecr.Repository;
  public readonly readEcr: ecr.Repository;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const isProduction = props.isProduction ?? false;

    // Expose ECR repos
    this.managementEcr = props.managementEcr;
    this.readEcr = props.readEcr;

    // ========================================
    // ECS Cluster
    // ========================================
    this.cluster = new ecs.Cluster(this, 'FeatureFlagsCluster', {
      vpc: props.vpc,
      clusterName: 'feature-flags-cluster',
      // Container Insights: activé seulement en prod pour réduire les coûts
      containerInsights: isProduction,
    });

    // ========================================
    // Application Load Balancer
    // ========================================
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.vpc,
      loadBalancerName: 'feature-flags-alb',
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      deletionProtection: isProduction,
      // Idle timeout élevé pour SSE (1 heure)
      idleTimeout: cdk.Duration.seconds(3600),
    });

    // ========================================
    // Target Groups
    // ========================================

    // Target Group Management - Configuration Standard
    const managementTG = new elbv2.ApplicationTargetGroup(this, 'ManagementTG', {
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      targetGroupName: 'ff-management-tg',
      healthCheck: {
        path: '/api/v1/management/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // Target Group Read - Optimisé pour SSE
    const readTG = new elbv2.ApplicationTargetGroup(this, 'ReadTG', {
      vpc: props.vpc,
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      targetGroupName: 'ff-read-tg',
      healthCheck: {
        path: '/api/v1/eval/health',
        interval: cdk.Duration.seconds(60),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
      deregistrationDelay: cdk.Duration.seconds(10),
    });

    // Configuration spéciale pour SSE
    const cfnReadTG = readTG.node.defaultChild as elbv2.CfnTargetGroup;
    cfnReadTG.addPropertyOverride('TargetGroupAttributes', [
      { Key: 'deregistration_delay.timeout_seconds', Value: '10' },
      { Key: 'slow_start.duration_seconds', Value: '30' },
      // { Key: 'deregistration_delay.connection_termination.enabled', Value: 'true' },
    ]);

    // ========================================
    // HTTP Listener avec Routage
    // ========================================
    const httpListener = this.alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'application/json',
        messageBody: JSON.stringify({
          error: 'Not Found',
          message: 'Use /api/v1/management/* or /api/v1/eval or /api/v1/sse/*',
        }),
      }),
    });

    // Règle Management API
    httpListener.addTargetGroups('ManagementRule', {
      targetGroups: [managementTG],
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns([
          '/api/v1/management/*',
          '/api/v1/management',
          '/health',
        ]),
      ],
    });

    // Règle Read API + SSE
    httpListener.addTargetGroups('ReadRule', {
      targetGroups: [readTG],
      priority: 20,
      conditions: [
        elbv2.ListenerCondition.pathPatterns([
          '/api/v1/eval',
          '/api/v1/eval/*',
          '/api/v1/sse/*',
          '/api/v1/flags/stream',
        ]),
      ],
    });

    // ========================================
    // IAM Role for ECS Tasks
    // ========================================
    const taskRole = new iam.Role(this, 'ECSTaskRole', {
      roleName: 'feature-flags-ecs-task-role',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Role for Feature Flags ECS Tasks',
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });

    // Accès au secret de la base de données
    props.dbSecret.grantRead(taskRole);

    // Permissions SNS/EventBridge (pour Management)
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowPublishEvents',
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish', 'events:PutEvents'],
        resources: [
          props.flagTopicArn,
          `arn:aws:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:event-bus/${props.eventBusName}`,
        ],
      }),
    );

    // Permissions SQS (pour Read)
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowConsumeSQS',
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
          'sqs:ChangeMessageVisibility',
        ],
        resources: [props.readQueueArn],
      }),
    );

    // Permissions SES (pour l'envoi d'emails)
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowSendEmail',
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail', 'ses:SendRawEmail', 'ses:SendTemplatedEmail'],
        resources: [
          props.sesIdentityArn,
          `arn:aws:ses:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:configuration-set/feature-flags-emails`,
        ],
      }),
    );

    // Permissions CloudWatch Logs
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudWatchLogs',
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: ['*'],
      }),
    );

    // ----------------------------------------------------------------------------------
    // NOUVEAU : Accorder les permissions Cognito nécessaires pour GÉRER les utilisateurs
    // et les GROUPES.
    // L'API du service Management Fargate utilisera ce rôle.
    // ----------------------------------------------------------------------------------
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:ListUsers',
          'cognito-idp:ListGroups',
          'cognito-idp:CreateGroup',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminEnableUser',
        ],
        resources: [
          // Cibler spécifiquement le User Pool
          cdk.Stack.of(this).formatArn({
            service: 'cognito-idp',
            resource: 'userpool',
            resourceName: props.userPoolId,
          }),
          // Nécessaire si on administre aussi les groupes
          cdk.Stack.of(this).formatArn({
            service: 'cognito-idp',
            resource: 'group',
            resourceName: `${props.userPoolId}/*`, // Appliquer à tous les groupes du pool
          }),
        ],
      }),
    );
    // ----------------------------------------------------------------------------------

    // ========================================
    // Log Groups
    // ========================================
    const managementLogGroup = new logs.LogGroup(this, 'ManagementLogs', {
      logGroupName: '/ecs/feature-flags/management',
      retention: isProduction ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const readLogGroup = new logs.LogGroup(this, 'ReadLogs', {
      logGroupName: '/ecs/feature-flags/read',
      retention: isProduction ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========================================
    // Task Definitions
    // ========================================

    // Task Definition Management
    const managementTaskDef = new ecs.FargateTaskDefinition(this, 'ManagementTaskDef', {
      family: 'feature-flags-management',
      // Réduction des coûts: 0.25 vCPU, 512MB en dev
      cpu: isProduction ? 512 : 256,
      memoryLimitMiB: isProduction ? 1024 : 512,
      taskRole,
    });

    // Task Definition Read
    const readTaskDef = new ecs.FargateTaskDefinition(this, 'ReadTaskDef', {
      family: 'feature-flags-read',
      // Plus de ressources pour le service Read (SSE)
      cpu: isProduction ? 512 : 256,
      memoryLimitMiB: isProduction ? 1024 : 512,
      taskRole,
    });

    // ========================================
    // Environment Variables
    // ========================================
    const commonEnv = {
      NODE_ENV: isProduction ? 'production' : 'development',
      AWS_REGION: cdk.Aws.REGION,
      REDIS_HOST: props.redisEndpoint,
      REDIS_PORT: '6379',
      COGNITO_USER_POOL_ID: props.userPoolId,
      COGNITO_CLIENT_ID: props.userPoolClientId,
      EVENT_BUS_NAME: props.eventBusName,
      FLAG_TOPIC_ARN: props.flagTopicArn,
      READ_QUEUE_URL: props.readQueueUrl,
      // SES Configuration
      SES_SENDER_EMAIL: props.senderEmail,
      SES_CONFIGURATION_SET: 'feature-flags-emails',
    };

    const managementEnv = {
      ...commonEnv,
      PORT: '3000',
      LOG_LEVEL: isProduction ? 'info' : 'debug',
    };

    const readEnv = {
      ...commonEnv,
      PORT: '3001',
      LOG_LEVEL: isProduction ? 'info' : 'debug',
      // Configuration SSE
      SSE_KEEPALIVE_INTERVAL: '30000',
      SSE_RETRY_TIMEOUT: '5000',
      MAX_SSE_CONNECTIONS: '10000',
    };

    // ========================================
    // Container Definitions
    // ========================================

    // Management Container
    // Management Container
    managementTaskDef.addContainer('management-service', {
      containerName: 'management-service',
      image: ecs.ContainerImage.fromEcrRepository(props.managementEcr, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'management',
        logGroup: managementLogGroup,
      }),
      environment: managementEnv,
      secrets: {
        DB_HOST: ecs.Secret.fromSecretsManager(props.dbSecret, 'host'),
        DB_PORT: ecs.Secret.fromSecretsManager(props.dbSecret, 'port'),
        DB_NAME: ecs.Secret.fromSecretsManager(props.dbSecret, 'dbname'),
        DB_USERNAME: ecs.Secret.fromSecretsManager(props.dbSecret, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(props.dbSecret, 'password'),
      },
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/api/v1/management/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(120), // Plus de temps pour démarrer
      },
    });

    // Read Container (optimisé pour SSE)
    readTaskDef.addContainer('read-service', {
      containerName: 'read-service',
      image: ecs.ContainerImage.fromEcrRepository(props.readEcr, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'read',
        logGroup: readLogGroup,
        mode: ecs.AwsLogDriverMode.NON_BLOCKING,
      }),
      environment: readEnv,
      secrets: {
        DB_HOST: ecs.Secret.fromSecretsManager(props.dbSecret, 'host'),
        DB_PORT: ecs.Secret.fromSecretsManager(props.dbSecret, 'port'),
        DB_NAME: ecs.Secret.fromSecretsManager(props.dbSecret, 'dbname'),
        DB_USERNAME: ecs.Secret.fromSecretsManager(props.dbSecret, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(props.dbSecret, 'password'),
      },
      portMappings: [{ containerPort: 3001, protocol: ecs.Protocol.TCP }],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3001/api/v1/eval/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(120),
      },
      ulimits: [
        {
          name: ecs.UlimitName.NOFILE,
          softLimit: 65536,
          hardLimit: 65536,
        },
      ],
    });

    // ========================================
    // Fargate Services
    // ========================================

    // Management Service
    this.managementService = new ecs.FargateService(this, 'ManagementService', {
      cluster: this.cluster,
      taskDefinition: managementTaskDef,
      serviceName: 'feature-flags-management',
      // Réduction coûts: 1 instance en dev
      desiredCount: isProduction ? 2 : 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.applicationSecurityGroup],
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
    });

    // Read Service
    this.readService = new ecs.FargateService(this, 'ReadService', {
      cluster: this.cluster,
      taskDefinition: readTaskDef,
      serviceName: 'feature-flags-read',
      // Réduction coûts: 1 instance en dev
      desiredCount: isProduction ? 2 : 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.applicationSecurityGroup],
      enableExecuteCommand: true,
      circuitBreaker: { rollback: true },
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    // Attach to target groups
    managementTG.addTarget(this.managementService);
    readTG.addTarget(this.readService);

    // ========================================
    // Auto Scaling (uniquement en production)
    // ========================================
    if (isProduction) {
      // Auto Scaling Read Service
      const readScaling = this.readService.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 10,
      });

      readScaling.scaleOnCpuUtilization('CpuScaling', {
        targetUtilizationPercent: 75,
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });

      readScaling.scaleOnMemoryUtilization('MemoryScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });

      // Auto Scaling Management Service
      const managementScaling = this.managementService.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 6,
      });

      managementScaling.scaleOnCpuUtilization('ManagementCpuScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(60),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });
    }

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'ALBDNSName', {
      value: this.alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS Name',
      exportName: 'FeatureFlagsALBDNS',
    });

    new cdk.CfnOutput(this, 'ManagementEndpoint', {
      value: `http://${this.alb.loadBalancerDnsName}/api/v1/management`,
      description: 'Management API Endpoint',
      exportName: 'FeatureFlagsManagementEndpoint',
    });

    new cdk.CfnOutput(this, 'EvalEndpoint', {
      value: `http://${this.alb.loadBalancerDnsName}/api/v1/eval`,
      description: 'Flag Evaluation API Endpoint',
      exportName: 'FeatureFlagsEvalEndpoint',
    });

    new cdk.CfnOutput(this, 'SSEEndpoint', {
      value: `http://${this.alb.loadBalancerDnsName}/api/v1/sse/subscribe`,
      description: 'SSE Streaming Endpoint',
      exportName: 'FeatureFlagsSSEEndpoint',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: 'FeatureFlagsClusterName',
    });

    new cdk.CfnOutput(this, 'ManagementServiceName', {
      value: this.managementService.serviceName,
      description: 'Management ECS Service Name',
      exportName: 'FeatureFlagsManagementServiceName',
    });

    new cdk.CfnOutput(this, 'ReadServiceName', {
      value: this.readService.serviceName,
      description: 'Read ECS Service Name',
      exportName: 'FeatureFlagsReadServiceName',
    });
  }
}
