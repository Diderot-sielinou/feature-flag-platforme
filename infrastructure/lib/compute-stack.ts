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
  // NOUVEAU: Références aux dépôts ECR créés par ECRStack
  managementEcr: ecr.Repository;
  readEcr: ecr.Repository;
}

export class ComputeStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly managementService: ecs.FargateService;
  public readonly readService: ecs.FargateService;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  // Références publiques pour MonitoringStack et autres
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
    });

    // Target Groups
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

    // Listener HTTP
    const httpListener = this.alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'application/json',
        messageBody: JSON.stringify({ error: 'Not Found' }),
      }),
    });

    httpListener.addTargetGroups('ManagementRule', {
      targetGroups: [managementTG],
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/api/v1/management/*', '/api/v1/management']),
      ],
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

    // ========================================
    // Task Definitions & Container Setup
    // ========================================

    // Log Groups
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
      memoryLimitMiB: 2048,
      cpu: 1024,
      taskRole: taskRole,
    });

    const readTaskDef = new ecs.FargateTaskDefinition(this, 'ReadTaskDef', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      taskRole: taskRole,
    });

    // Base URL de connexion à la base de données (pour Prisma)
    const databaseUrl = `postgresql://{{resolve:secretsmanager:${props.dbSecret.secretArn}:SecretString:username}}:{{resolve:secretsmanager:${props.dbSecret.secretArn}:SecretString:password}}@${props.dbEndpoint}:5432/featureflags?schema=public`;

    // Environment variables communes
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
      DATABASE_URL: databaseUrl, // Pour les migrations et les opérations d'écriture
      PORT: '3000',
    };

    const readEnv = {
      ...commonEnv,
      DATABASE_URL: databaseUrl, // CORRECTION: Nécessaire pour initialiser le client Prisma
      PORT: '3001',
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
      portMappings: [{ containerPort: 3000 }],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ----------------------------------------
    // Read Container
    // ----------------------------------------
    readTaskDef.addContainer('read-service', {
      containerName: 'read-service',
      image: readImage,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'read',
        logGroup: readLogGroup,
      }),
      environment: readEnv,
      portMappings: [{ containerPort: 3001 }],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3001/health || exit 1'],
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
      desiredCount: 2,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.applicationSecurityGroup],
      enableExecuteCommand: true,
    });

    this.readService = new ecs.FargateService(this, 'ReadService', {
      cluster: this.cluster,
      taskDefinition: readTaskDef,
      desiredCount: 3,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.applicationSecurityGroup],
      enableExecuteCommand: true,
    });

    // Attach to target groups
    managementTG.addTarget(this.managementService);
    readTG.addTarget(this.readService);

    // Auto Scaling for Read Service
    const readScaling = this.readService.autoScaleTaskCount({
      minCapacity: 3,
      maxCapacity: 20,
    });

    readScaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    readScaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Auto Scaling for Management Service
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

    // Outputs
    new cdk.CfnOutput(this, 'ALBDNSName', {
      value: this.alb.loadBalancerDnsName,
      exportName: 'FeatureFlagsALBDNS',
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
