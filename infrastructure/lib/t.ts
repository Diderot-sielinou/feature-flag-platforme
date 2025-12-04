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
    // IAM Roles for ECS Tasks
    // ========================================
    
    // --- 1. Rôle de Tâche (Task Role) pour l'Application (Management & Read) ---
    const appTaskRole = new iam.Role(this, 'ECSTaskRole', {
      roleName: 'feature-flags-ecs-task-role',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Role for Feature Flags ECS Tasks (App)',
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });

    // Accès au secret de la base de données (Note: le Task Execution Role est utilisé pour la lecture)
    // Nous ajoutons ici les permissions spécifiques à l'application (SNS, SQS, SES, Cognito)
    props.dbSecret.grantRead(appTaskRole); // La Task Role a besoin d'un accès de lecture au secret si le conteneur l'appelle

    // Permissions SNS/EventBridge (pour Management)
    appTaskRole.addToPolicy(
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
    appTaskRole.addToPolicy(
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
    appTaskRole.addToPolicy(
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
    appTaskRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudWatchLogs',
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: ['*'],
      }),
    );

    // Permissions Cognito (pour Management)
    appTaskRole.addToPolicy(
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
          cdk.Stack.of(this).formatArn({
            service: 'cognito-idp',
            resource: 'userpool',
            resourceName: props.userPoolId,
          }),
          cdk.Stack.of(this).formatArn({
            service: 'cognito-idp',
            resource: 'group',
            resourceName: `${props.userPoolId}/*`,
          }),
        ],
      }),
    );

    // --- 2. Rôle de Tâche (Task Role) pour la Migration (PoLP) ---
    // Ce rôle n'a AUCUNE permission AWS (il ne fait qu'exécuter Prisma et se connecter à la DB).
    // Les secrets sont gérés par le Rôle d'Exécution.
    const migrationTaskRole = new iam.Role(this, 'MigrationTaskRole', {
        roleName: 'feature-flags-migration-task-role',
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        description: 'Minimal IAM Role for Database Migration Task.',
    });
    // ATTENTION: Si votre script de migration devait utiliser AWS CLI (S3, etc.), les permissions seraient ajoutées ici.
    // Dans le cas de Prisma, aucune permission n'est requise.


    // --- 3. Rôle d'Exécution (Task Execution Role) partagé ---
    // Nous avons besoin d'un Task Execution Role qui peut lire les secrets et tirer les images.
    // L'agent ECS va utiliser ce rôle pour le démarrage de TOUTES les tâches.
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'ECS Task Execution Role for ECR and Secrets access.',
    });
    // Attache la politique par défaut d'ECS (lecture d'ECR, logs CloudWatch)
    taskExecutionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
    );
    // Ajoute la permission de lire le secret RDS (crucial pour l'injection)
    props.dbSecret.grantRead(taskExecutionRole);


    // ========================================
    // Task Definitions
    // ========================================

    // Task Definition Management
    const managementTaskDef = new ecs.FargateTaskDefinition(this, 'ManagementTaskDef', {
      family: 'feature-flags-management',
      cpu: isProduction ? 512 : 256,
      memoryLimitMiB: isProduction ? 1024 : 512,
      taskRole: appTaskRole, // Rôle complet de l'application
      executionRole: taskExecutionRole,
    });

    // Task Definition Read
    const readTaskDef = new ecs.FargateTaskDefinition(this, 'ReadTaskDef', {
      family: 'feature-flags-read',
      cpu: isProduction ? 512 : 256,
      memoryLimitMiB: isProduction ? 1024 : 512,
      taskRole: appTaskRole, // Rôle complet de l'application
      executionRole: taskExecutionRole,
    });

    // ----------------------------------------------------------------------------------
    // NOUVEAU : Task Definition de Migration
    // ----------------------------------------------------------------------------------
    const migrationLogGroup = new logs.LogGroup(this, 'MigrationLogs', {
        logGroupName: '/ecs/feature-flags/migration',
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const migrationTaskDef = new ecs.FargateTaskDefinition(this, 'MigrationTaskDef', {
        family: 'feature-flags-migration',
        cpu: 256, // Peut être minimal
        memoryLimitMiB: 512,
        taskRole: migrationTaskRole, // ✅ Rôle minimaliste (PoLP)
        executionRole: taskExecutionRole, // Rôle qui peut lire les secrets et l'image
    });

    migrationTaskDef.addContainer('migration-container', {
        containerName: 'migration', // Nom utilisé dans l'override de la commande run-task
        image: ecs.ContainerImage.fromEcrRepository(props.managementEcr, 'latest'),
        logging: ecs.LogDrivers.awsLogs({
            streamPrefix: 'migration',
            logGroup: migrationLogGroup,
        }),
        // L'environnement minimal requis pour le conteneur
        environment: {
            NODE_ENV: 'production', // Pour forcer la config de prod
            // Autres variables si nécessaires (ex: REDIS_HOST)
        },
        // Secrets nécessaires pour la construction de la DATABASE_URL par Prisma/NestJS
        secrets: {
            DB_HOST: ecs.Secret.fromSecretsManager(props.dbSecret, 'host'),
            DB_PORT: ecs.Secret.fromSecretsManager(props.dbSecret, 'port'),
            DB_NAME: ecs.Secret.fromSecretsManager(props.dbSecret, 'dbname'),
            DB_USERNAME: ecs.Secret.fromSecretsManager(props.dbSecret, 'username'),
            DB_PASSWORD: ecs.Secret.fromSecretsManager(props.dbSecret, 'password'),
        },
        // Pas de port mapping ni de health check requis pour une tâche ponctuelle
    });
    // ----------------------------------------------------------------------------------


    // ========================================
    // Environment Variables (pour les services)
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
    // Container Definitions (pour les services)
    // ========================================

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
        startPeriod: cdk.Duration.seconds(120),
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

    // ... (autres outputs existants)

    // ----------------------------------------------------------------------------------
    // NOUVEAU OUTPUT : Nom de la Task Definition de Migration pour le CI/CD
    // ----------------------------------------------------------------------------------
    new cdk.CfnOutput(this, 'MigrationTaskDefFamily', {
      value: migrationTaskDef.family,
      description: 'ECS Task Definition Family name for database migrations.',
      exportName: 'FeatureFlagsMigrationTaskDefFamily',
    });
    // ----------------------------------------------------------------------------------
  }
}