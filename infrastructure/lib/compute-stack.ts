import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface ComputeStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  applicationSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.Secret;
  dbEndpoint: string;
  albSecurityGroup: ec2.SecurityGroup;
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
  // public readonly managementEcr: ecr.Repository;
  // public readonly readEcr: ecr.Repository;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // ========================================
    // ECS Cluster
    // ========================================
    this.cluster = new ecs.Cluster(this, 'FeatureFlagsCluster', {
      vpc: props.vpc,
      clusterName: 'feature-flags-cluster',
      containerInsights: true,
    });

    // ========================================
    // ECR Repositories
    // ========================================
    // this.managementEcr = new ecr.Repository(this, 'ManagementAPIRepo', {
    //   repositoryName: 'feature-flags/api-management',
    //   removalPolicy: cdk.RemovalPolicy.DESTROY,
    //   imageScanOnPush: true,
    //   lifecycleRules: [
    //     {
    //       description: 'Keep last 10 images',
    //       maxImageCount: 10,
    //     },
    //   ],
    // });

    // this.readEcr = new ecr.Repository(this, 'ReadAPIRepo', {
    //   repositoryName: 'feature-flags/api-read',
    //   removalPolicy: cdk.RemovalPolicy.DESTROY,
    //   imageScanOnPush: true,
    //   lifecycleRules: [
    //     {
    //       description: 'Keep last 10 images',
    //       maxImageCount: 10,
    //     },
    //   ],
    // });

    // ========================================
    // Application Load Balancer
    // ========================================
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      deletionProtection: false, // Pour faciliter les tests
    });

    // Target Groups avec health checks optimisés
    const managementTG = new elbv2.ApplicationTargetGroup(this, 'ManagementTG', {
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    const readTG = new elbv2.ApplicationTargetGroup(this, 'ReadTG', {
      vpc: props.vpc,
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        healthyHttpCodes: '200',
      },
      deregistrationDelay: cdk.Duration.seconds(10),
    });

    // ========================================
    // ALB Listeners & Routing
    // ========================================
    const httpListener = this.alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'application/json',
        messageBody: JSON.stringify({ error: 'Not Found' }),
      }),
    });

    // Routes vers les services
    httpListener.addTargetGroups('ManagementRule', {
      targetGroups: [managementTG],
      priority: 10,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/v1/management/*'])],
    });

    httpListener.addTargetGroups('ReadRule', {
      targetGroups: [readTG],
      priority: 20,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/v1/eval', '/api/v1/sse/*'])],
    });

    // ========================================
    // IAM Role for ECS Tasks
    // ========================================
    const taskRole = new iam.Role(this, 'ECSTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Role for Feature Flags ECS Tasks',
    });

    // Grant read access to DB secrets
    props.dbSecret.grantRead(taskRole);

    // Permissions pour SNS/SQS/EventBridge
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish', 'events:PutEvents'],
        resources: [props.flagTopicArn],
      }),
    );

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

    // Permissions pour CloudWatch Logs
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: ['*'],
      }),
    );

    // ========================================
    // CloudWatch Logs Groups
    // ========================================
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

    // ========================================
    // Task Definitions
    // ========================================
    const managementTaskDef = new ecs.FargateTaskDefinition(this, 'ManagementTaskDef', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      taskRole: taskRole,
    });

    const readTaskDef = new ecs.FargateTaskDefinition(this, 'ReadTaskDef', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      taskRole: taskRole,
    });

    // ========================================
    // Environment Variables
    // ========================================
    const commonEnv = {
      NODE_ENV: 'production',
      AWS_REGION: cdk.Aws.REGION,

      // Redis
      REDIS_HOST: props.redisEndpoint,
      REDIS_PORT: '6379',
      REDIS_TLS: 'false',

      // Cognito
      COGNITO_USER_POOL_ID: props.userPoolId,
      COGNITO_CLIENT_ID: props.userPoolClientId,

      // Messaging
      EVENT_BUS_NAME: props.eventBusName,
      FLAG_TOPIC_ARN: props.flagTopicArn,
      READ_QUEUE_URL: props.readQueueUrl,
    };

    const managementEnv = {
      ...commonEnv,
      PORT: '3000',
      JWT_SECRET: 'CHANGE_IN_PRODUCTION', // À remplacer par un secret AWS
    };

    // Secrets (références sécurisées)
    const dbSecrets = {
      DATABASE_URL: ecs.Secret.fromSecretsManager(props.dbSecret, 'DATABASE_URL'),
    };

    const readEnv = {
      ...commonEnv,
      PORT: '3001',
    };

    // ========================================
    // 🔥 STRATÉGIE D'IMAGE INITIALE
    // ========================================
    // Option 1: Image placeholder qui répond au health check
    const placeholderImage = 'public.ecr.aws/docker/library/httpd:2.4-alpine';

    // Option 2: Référence ECR (nécessite que l'image existe)
    // const managementImage = ecs.ContainerImage.fromEcrRepository(this.managementEcr, 'latest');

    // ========================================
    // Container Definitions
    // ========================================
    managementTaskDef.addContainer('management-service', {
      // 🚨 DÉMARRAGE: Utiliser placeholder, puis mettre à jour via GitHub Actions
      image: ecs.ContainerImage.fromRegistry(placeholderImage),

      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'management',
        logGroup: managementLogGroup,
      }),
      environment: managementEnv,
      secrets: dbSecrets,
      portMappings: [{ containerPort: 3000 }],

      // Health check léger pour httpd
      healthCheck: {
        command: [
          'CMD-SHELL',
          'wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1',
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    readTaskDef.addContainer('read-service', {
      image: ecs.ContainerImage.fromRegistry(placeholderImage),

      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'read',
        logGroup: readLogGroup,
      }),
      environment: readEnv,
      portMappings: [{ containerPort: 3001 }],

      healthCheck: {
        command: [
          'CMD-SHELL',
          'wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1',
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ========================================
    // Fargate Services
    // ========================================
    this.managementService = new ecs.FargateService(this, 'ManagementService', {
      cluster: this.cluster,
      taskDefinition: managementTaskDef,
      desiredCount: 1, // Commencer avec 1 seule instance
      minHealthyPercent: 0, // Permettre le remplacement complet lors du premier déploiement
      maxHealthyPercent: 200,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.applicationSecurityGroup],
      enableExecuteCommand: true,
      circuitBreaker: {
        rollback: true, // Rollback automatique en cas d'échec
      },
    });

    this.readService = new ecs.FargateService(this, 'ReadService', {
      cluster: this.cluster,
      taskDefinition: readTaskDef,
      desiredCount: 1,
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.applicationSecurityGroup],
      enableExecuteCommand: true,
      circuitBreaker: {
        rollback: true,
      },
    });

    // Attach to target groups
    managementTG.addTarget(this.managementService);
    readTG.addTarget(this.readService);

    // ========================================
    // Auto Scaling (désactivé initialement)
    // ========================================
    // Vous pourrez activer ceci après le premier déploiement réussi
    /*
    const readScaling = this.readService.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10,
    });

    readScaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
    */

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'ALBDNSName', {
      value: this.alb.loadBalancerDnsName,
      description: 'URL du Load Balancer',
      exportName: 'FeatureFlagsALBDNS',
    });

    new cdk.CfnOutput(this, 'ManagementRepoURI', {
      value: props.managementEcr.repositoryUri,
      description: 'URI du dépôt ECR Management',
    });

    new cdk.CfnOutput(this, 'ReadRepoURI', {
      value: props.readEcr.repositoryUri,
      description: 'URI du dépôt ECR Read',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'Nom du cluster ECS',
    });
  }
}
