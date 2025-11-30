import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as appscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import { Construct } from 'constructs';

interface ComputeStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  applicationSecurityGroup: ec2.SecurityGroup;
  albSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.Secret;
  dbEndpoint: string;
  redisEndpoint: string;
  userPoolId: string;
  userPoolClientId: string;
  flagTopicArn: string;
  readQueueArn: string;
  readQueueUrl: string;
  eventBusName: string;
  managementEcr: ecr.Repository;
  readEcr: ecr.Repository;
}

export class ComputeStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly managementService: ecs.FargateService;
  public readonly readService: ecs.FargateService;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly managementEcr: ecr.Repository;
  public readonly readEcr: ecr.Repository;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    this.managementEcr = props.managementEcr;
    this.readEcr = props.readEcr;

    // ========================================
    // ECS Cluster
    // ========================================
    this.cluster = new ecs.Cluster(this, 'FeatureFlagsCluster', {
      vpc: props.vpc,
      clusterName: 'feature-flags-cluster',
      containerInsights: true,
    });

    // ========================================
    // Application Load Balancer
    // ========================================
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      deletionProtection: false,
      // Augmenter le idle timeout de l'ALB lui-même pour SSE
      // Par défaut 60s, on passe à 1 heure (3600s)
      idleTimeout: cdk.Duration.seconds(3600),
    });

    // ========================================
    // Target Groups avec Support SSE
    // ========================================

    // Target Group Management - Configuration Standard
    const managementTG = new elbv2.ApplicationTargetGroup(this, 'ManagementTG', {
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      targetGroupName: 'ff-management-tg',
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
      deregistrationDelay: cdk.Duration.seconds(30),
      // Idle timeout standard pour les requêtes courtes
    });

    // Target Group Read - Configuration OPTIMISÉE pour SSE
    const readTG = new elbv2.ApplicationTargetGroup(this, 'ReadTG', {
      vpc: props.vpc,
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      targetGroupName: 'ff-read-tg',
      healthCheck: {
        path: '/health',
        // Health check moins fréquent pour ne pas perturber les connexions SSE
        interval: cdk.Duration.seconds(60),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
      // Déregistration rapide pour éviter de bloquer les deployments
      deregistrationDelay: cdk.Duration.seconds(10),
    });

    const cfnReadTG = readTG.node.defaultChild as elbv2.CfnTargetGroup;
    cfnReadTG.addPropertyOverride('TargetGroupAttributes', [
      {
        Key: 'deregistration_delay.timeout_seconds',
        Value: '10',
      },
      {
        Key: 'slow_start.duration_seconds',
        Value: '30',
      },
      // ⚡ ATTRIBUT ESSENTIEL POUR SSE ⚡
      // Configure le timeout de connexion idle à 3600 secondes (1 heure)
      {
        Key: 'deregistration_delay.connection_termination.enabled',
        Value: 'true',
      },
    ]);

    // ========================================
    // Listener HTTP avec Routage Optimisé
    // ========================================
    const httpListener = this.alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'application/json',
        messageBody: JSON.stringify({
          error: 'Not Found',
          message: 'Invalid endpoint. Use /api/v1/management/* or /api/v1/eval or /api/v1/sse/*',
        }),
      }),
    });

    // Règle pour Management API (priorité plus basse = évaluée en premier)
    httpListener.addTargetGroups('ManagementRule', {
      targetGroups: [managementTG],
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns([
          '/api/v1/management/*',
          '/api/v1/management',
          '/health', // Health check du load balancer
        ]),
      ],
    });

    // Règle pour Read API + SSE Endpoints
    httpListener.addTargetGroups('ReadRule', {
      targetGroups: [readTG],
      priority: 20,
      conditions: [
        elbv2.ListenerCondition.pathPatterns([
          '/api/v1/eval',
          '/api/v1/eval/*',
          '/api/v1/sse/*',
          '/api/v1/flags/stream', // Route SSE alternative
        ]),
      ],
    });

    // ========================================
    // IAM Role for ECS Tasks
    // ========================================
    const taskRole = new iam.Role(this, 'ECSTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Role for Feature Flags ECS Tasks',
      managedPolicies: [
        // Permet l'exécution de commandes ECS Exec pour debugging
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // Grant read access to DB secret
    props.dbSecret.grantRead(taskRole);

    // Permissions pour Management (SNS/EventBridge Publish)
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish', 'events:PutEvents'],
        resources: [
          props.flagTopicArn,
          `arn:aws:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:event-bus/${props.eventBusName}`,
        ],
      }),
    );

    // Permissions pour Read (SQS Consume)
    taskRole.addToPolicy(
      new iam.PolicyStatement({
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

    // CloudWatch Logs permissions
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: ['*'],
      }),
    );

    // ========================================
    // Task Definitions & Container Setup
    // ========================================

    // Log Groups avec rétention appropriée
    const managementLogGroup = new logs.LogGroup(this, 'ManagementLogs', {
      logGroupName: '/ecs/feature-flags/management',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const readLogGroup = new logs.LogGroup(this, 'ReadLogs', {
      logGroupName: '/ecs/feature-flags/read',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Task Definitions
    const managementTaskDef = new ecs.FargateTaskDefinition(this, 'ManagementTaskDef', {
      memoryLimitMiB: 512,
      cpu: 1024,
      taskRole: taskRole,
    });

    const readTaskDef = new ecs.FargateTaskDefinition(this, 'ReadTaskDef', {
      memoryLimitMiB: 512,
      cpu: 1024,
      taskRole: taskRole,
      // Ephemeral storage pour les connexions SSE en mémoire
      ephemeralStorageGiB: 21, // Minimum 21 GB
    });

    // Database connection URL (for Prisma)
    const databaseUrl = `postgresql://{{resolve:secretsmanager:${props.dbSecret.secretArn}:SecretString:username}}:{{resolve:secretsmanager:${props.dbSecret.secretArn}:SecretString:password}}@${props.dbEndpoint}:5432/featureflags?schema=public`;

    // Environment common variables
    const commonEnv = {
      NODE_ENV: 'production',
      AWS_REGION: cdk.Aws.REGION,
      REDIS_HOST: props.redisEndpoint,
      REDIS_PORT: '6379',
      COGNITO_USER_POOL_ID: props.userPoolId,
      COGNITO_CLIENT_ID: props.userPoolClientId,
      EVENT_BUS_NAME: props.eventBusName,
      FLAG_TOPIC_ARN: props.flagTopicArn,
      READ_QUEUE_URL: props.readQueueUrl,
    };

    const managementEnv = {
      ...commonEnv,
      DATABASE_URL: databaseUrl,
      PORT: '3000',
      LOG_LEVEL: 'info',
    };

    const readEnv = {
      ...commonEnv,
      DATABASE_URL: databaseUrl,
      PORT: '3001',
      LOG_LEVEL: 'info',
      // Configuration spécifique SSE
      SSE_KEEPALIVE_INTERVAL: '30000', // 30 secondes (en ms)
      SSE_RETRY_TIMEOUT: '5000', // 5 secondes
      MAX_SSE_CONNECTIONS: '10000', // Limite de connexions SSE simultanées
    };

    // Images ECS
    const managementImage = ecs.ContainerImage.fromEcrRepository(props.managementEcr, 'latest');
    const readImage = ecs.ContainerImage.fromEcrRepository(props.readEcr, 'latest');

    // ----------------------------------------
    // Management Container
    // ----------------------------------------
    managementTaskDef.addContainer('management-service', {
      containerName: 'management-service',
      image: managementImage,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'management',
        logGroup: managementLogGroup,
      }),
      environment: managementEnv,
      portMappings: [{ containerPort: 3000, protocol: ecs.Protocol.TCP }],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
      // Limites de ressources
      memoryReservationMiB: 1024,
      cpu: 512,
    });

    // ----------------------------------------
    // Read Container - Optimisé pour SSE
    // ----------------------------------------
    readTaskDef.addContainer('read-service', {
      containerName: 'read-service',
      image: readImage,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'read',
        logGroup: readLogGroup,
        // Mode non-blocking pour éviter de ralentir les connexions SSE
        mode: ecs.AwsLogDriverMode.NON_BLOCKING,
      }),
      environment: readEnv,
      portMappings: [{ containerPort: 3001, protocol: ecs.Protocol.TCP }],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3001/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
      // Ressources augmentées pour gérer les connexions SSE
      memoryReservationMiB: 1536,
      cpu: 768,
      // Limites ulimit pour gérer beaucoup de connexions simultanées
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
    this.managementService = new ecs.FargateService(this, 'ManagementService', {
      cluster: this.cluster,
      taskDefinition: managementTaskDef,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.applicationSecurityGroup],
      enableExecuteCommand: true,
      serviceName: 'feature-flags-management',
      // Circuit Breaker pour éviter les rollbacks infinis
      circuitBreaker: {
        rollback: true,
      },
    });

    this.readService = new ecs.FargateService(this, 'ReadService', {
      cluster: this.cluster,
      taskDefinition: readTaskDef,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.applicationSecurityGroup],
      enableExecuteCommand: true,
      serviceName: 'feature-flags-read',
      circuitBreaker: {
        rollback: true,
      },
      // ⚡ IMPORTANT pour SSE: Permet le drainage des connexions
      // Augmente le temps de drainage pour laisser les clients SSE se reconnecter
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    // Attach to target groups
    managementTG.addTarget(this.managementService);
    readTG.addTarget(this.readService);

    // ========================================
    // Auto Scaling - Optimisé pour SSE
    // ========================================

    // Auto Scaling pour Read Service (gérant les connexions SSE)
    const readScaling = this.readService.autoScaleTaskCount({
      minCapacity: 3,
      maxCapacity: 20,
    });

    // Scaling basé sur CPU - seuil plus élevé car SSE consomme peu de CPU
    readScaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 75, // Augmenté de 70 à 75
      scaleInCooldown: cdk.Duration.seconds(300), // 5 min - plus long pour SSE
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Scaling basé sur Memory - critique pour SSE (beaucoup de connexions)
    readScaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 70, // Seuil bas car les connexions SSE consomment de la mémoire
      scaleInCooldown: cdk.Duration.seconds(300), // 5 min
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ⚡ NOUVEAU: Scaling basé sur le nombre de connexions ALB
    // Très utile pour SSE car une métrique directe du nombre de clients connectés
    readScaling.scaleOnMetric('ConnectionScaling', {
      metric: this.alb.metrics.targetConnectionErrorCount({
        statistic: 'Average',
      }),
      scalingSteps: [
        { upper: 100, change: -1 },
        { lower: 500, change: +1 },
        { lower: 1000, change: +2 },
        { lower: 2000, change: +3 },
      ],
      adjustmentType: appscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    });

    // Auto Scaling pour Management Service
    const managementScaling = this.managementService.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10,
    });

    managementScaling.scaleOnCpuUtilization('ManagementCpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    managementScaling.scaleOnMemoryUtilization('ManagementMemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'ALBDNSName', {
      value: this.alb.loadBalancerDnsName,
      description: 'DNS Name of the Application Load Balancer',
      exportName: 'FeatureFlagsALBDNS',
    });

    new cdk.CfnOutput(this, 'SSEEndpoint', {
      value: `http://${this.alb.loadBalancerDnsName}/api/v1/sse/subscribe`,
      description: 'SSE Endpoint for SDK connections',
    });

    new cdk.CfnOutput(this, 'EvalEndpoint', {
      value: `http://${this.alb.loadBalancerDnsName}/api/v1/eval`,
      description: 'Flag Evaluation API Endpoint',
    });

    new cdk.CfnOutput(this, 'ManagementEndpoint', {
      value: `http://${this.alb.loadBalancerDnsName}/api/v1/management`,
      description: 'Management API Endpoint',
    });

    new cdk.CfnOutput(this, 'ManagementServiceName', {
      value: this.managementService.serviceName,
      exportName: 'FeatureFlagsManagementServiceName',
    });

    new cdk.CfnOutput(this, 'ReadServiceName', {
      value: this.readService.serviceName,
      exportName: 'FeatureFlagsReadServiceName',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      exportName: 'FeatureFlagsClusterName',
    });
  }
}
