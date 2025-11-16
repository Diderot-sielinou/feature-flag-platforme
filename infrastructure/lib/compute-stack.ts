import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
// Ajouter les imports pour la messagerie
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';

// Mise à jour de l'interface pour inclure les ressources de messagerie
interface ComputeStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  applicationSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.Secret;
  dbEndpoint: string;
  // *** CHANGEMENT: On n'utilise plus redisEndpoint ***
  redisEndpoint: string;
  userPoolId: string;
  userPoolClientId: string;
  // *** AJOUT: ARNs/URLs des ressources de messagerie ***
  flagTopicArn: string;
  readQueueArn: string;
  readQueueUrl: string;
  eventBusName: string;
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

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'FeatureFlagsCluster', {
      vpc: props.vpc,
      clusterName: 'feature-flags-cluster',
      containerInsights: true,
    });

    // ECR Repositories
    const managementRepo = new ecr.Repository(this, 'ManagementAPIRepo', {
      repositoryName: 'feature-flags/api-management',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      imageScanOnPush: true,
    });

    const readRepo = new ecr.Repository(this, 'ReadAPIRepo', {
      repositoryName: 'feature-flags/api-read',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      imageScanOnPush: true,
    });

    this.managementEcr = managementRepo;
    this.readEcr = readRepo;

    // Application Load Balancer
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
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
      },
      deregistrationDelay: cdk.Duration.seconds(10),
    });

    // Listeners
    const httpListener = this.alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      // certificates: [
      //   // TODO: Add your ACM certificate ARN
      // ],
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'application/json',
        messageBody: JSON.stringify({ error: 'Not Found' }),
      }),
    });

    // Route to services based on path
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

    // Redirect HTTP to HTTPS
    // this.alb.addListener('HTTPListener', {
    //   port: 80,
    //   protocol: elbv2.ApplicationProtocol.HTTP,
    //   defaultAction: elbv2.ListenerAction.redirect({
    //     protocol: 'HTTPS',
    //     port: '443',
    //     permanent: true,
    //   }),
    // });

    // IAM Role for ECS Tasks
    const taskRole = new iam.Role(this, 'ECSTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Role for Feature Flags ECS Tasks',
    });

    // Grant read access to secrets
    props.dbSecret.grantRead(taskRole);

    // *** CHANGEMENT: Accorder les permissions de messagerie ***
    // Permissions pour le service de gestion (publish)
    const managementPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sns:Publish', // Pour publier sur SNS
        'events:PutEvents', // Pour publier sur EventBridge
      ],
      resources: [props.flagTopicArn], // ou l'ARN de l'EventBus si vous l'utilisez directement
    });
    taskRole.addToPolicy(managementPolicy);

    // Permissions pour le service de lecture (consume SQS)
    const readPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sqs:ReceiveMessage',
        'sqs:DeleteMessage',
        'sqs:GetQueueAttributes',
        'sqs:ChangeMessageVisibility',
      ],
      resources: [props.readQueueArn], // ARN de la queue READ
    });
    taskRole.addToPolicy(readPolicy);

    // CloudWatch Logs Groups
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
      taskRole: taskRole, // Le rôle avec les nouvelles permissions
    });

    const readTaskDef = new ecs.FargateTaskDefinition(this, 'ReadTaskDef', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      taskRole: taskRole, // Le même rôle est suffisant ici si les permissions sont suffisantes
      // Si vous souhaitez des rôles séparés pour plus de granularité, créez-en un autre.
    });

    // Environment variables
    // *** CHANGEMENT: Supprimer REDIS_HOST et REDIS_PORT, ajouter les variables de messagerie ***
    // Environment variables
    const commonEnv = {
      NODE_ENV: 'production',
      AWS_REGION: cdk.Aws.REGION,

      // ---- REDIS (corrigé pour TLS) ----
      REDIS_HOST: props.redisEndpoint,
      REDIS_PORT: '6379',
      REDIS_TLS: 'true', // <<< important pour redis avec transitEncryptionEnabled
      REDIS_URL: `rediss://${props.redisEndpoint}:6379`, // <<< connexion complète via TLS

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
      DATABASE_URL: `postgresql://{{resolve:secretsmanager:${props.dbSecret.secretArn}:SecretString:username}}:{{resolve:secretsmanager:${props.dbSecret.secretArn}:SecretString:password}}@${props.dbEndpoint}:5432/featureflags`,
      PORT: '3000',
    };

    const readEnv = {
      ...commonEnv, // Toujours avec les variables de messagerie pour les SSE ou autres usages
      PORT: '3001',
    };

    // Container Definitions
    managementTaskDef.addContainer('management-service', {
      image: ecs.ContainerImage.fromEcrRepository(managementRepo, 'latest'),
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

    readTaskDef.addContainer('read-service', {
      image: ecs.ContainerImage.fromEcrRepository(readRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'read',
        logGroup: readLogGroup,
      }),
      environment: readEnv, // Avec les variables de messagerie
      portMappings: [{ containerPort: 3001 }],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3001/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Fargate Services
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

    // Outputs (inchangés)
    new cdk.CfnOutput(this, 'ALBDNSName', {
      value: this.alb.loadBalancerDnsName,
      exportName: 'FeatureFlagsALBDNS',
    });

    new cdk.CfnOutput(this, 'ManagementRepoURI', {
      value: managementRepo.repositoryUri,
    });

    new cdk.CfnOutput(this, 'ReadRepoURI', {
      value: readRepo.repositoryUri,
    });
  }
}
