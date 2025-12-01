import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkStackProps extends cdk.StackProps {
  isProduction?: boolean;
}

/**
 * Stack responsable de la configuration réseau:
 * - VPC avec subnets publics, privés et isolés
 * - Security Groups pour ALB, Applications, Database, Cache
 * - VPC Endpoints pour les services AWS
 */
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly applicationSecurityGroup: ec2.SecurityGroup;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly cacheSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: NetworkStackProps) {
    super(scope, id, props);

    const isProduction = props?.isProduction ?? false;

    // ========================================
    // VPC Configuration
    // ========================================
    // Mode développement: 2 AZs, 1 NAT Gateway pour réduire les coûts
    // Mode production: 3 AZs, 2 NAT Gateways pour haute disponibilité
    this.vpc = new ec2.Vpc(this, 'FeatureFlagsVPC', {
      vpcName: 'feature-flags-vpc',
      maxAzs: isProduction ? 3 : 2,
      // Réduction des coûts: 1 NAT Gateway en dev, 2 en prod
      natGateways: isProduction ? 2 : 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // ========================================
    // VPC Endpoints pour les services AWS
    // Permet aux services privés d'accéder aux services AWS sans passer par Internet
    // ========================================

    // Endpoint SQS
    this.vpc.addInterfaceEndpoint('SQSEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SQS,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Endpoint SNS
    this.vpc.addInterfaceEndpoint('SNSEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SNS,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Endpoint EventBridge
    this.vpc.addInterfaceEndpoint('EventBridgeEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.EVENTBRIDGE,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Endpoint Secrets Manager (pour les credentials DB)
    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Endpoint CloudWatch Logs
    this.vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Endpoint ECR API
    this.vpc.addInterfaceEndpoint('ECRApiEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Endpoint ECR Docker
    this.vpc.addInterfaceEndpoint('ECRDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Gateway Endpoint S3 (gratuit)
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // ========================================
    // Security Groups
    // ========================================

    // Security Group pour ALB (Application Load Balancer)
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSG', {
      vpc: this.vpc,
      securityGroupName: 'feature-flags-alb-sg',
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    // Autoriser le trafic HTTP/HTTPS depuis Internet
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from Internet',
    );
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS from Internet',
    );

    // Security Group pour les applications (ECS Fargate)
    this.applicationSecurityGroup = new ec2.SecurityGroup(this, 'AppSG', {
      vpc: this.vpc,
      securityGroupName: 'feature-flags-app-sg',
      description: 'Security group for application services (ECS)',
      allowAllOutbound: true,
    });

    // Autoriser le trafic depuis ALB vers les services
    this.applicationSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(3000),
      'Allow ALB to reach Management API',
    );
    this.applicationSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(3001),
      'Allow ALB to reach Read API',
    );

    // Security Group pour RDS PostgreSQL
    this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSG', {
      vpc: this.vpc,
      securityGroupName: 'feature-flags-db-sg',
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: false,
    });

    // Autoriser PostgreSQL depuis les applications
    this.databaseSecurityGroup.addIngressRule(
      this.applicationSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from application',
    );

    // Security Group pour ElastiCache Redis
    this.cacheSecurityGroup = new ec2.SecurityGroup(this, 'CacheSG', {
      vpc: this.vpc,
      securityGroupName: 'feature-flags-cache-sg',
      description: 'Security group for ElastiCache Redis',
      allowAllOutbound: false,
    });

    // Autoriser Redis depuis les applications
    this.cacheSecurityGroup.addIngressRule(
      this.applicationSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Redis access from application',
    );

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'VPCId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: 'FeatureFlagsVPCId',
    });

    new cdk.CfnOutput(this, 'VPCCidr', {
      value: this.vpc.vpcCidrBlock,
      description: 'VPC CIDR Block',
    });

    new cdk.CfnOutput(this, 'PublicSubnets', {
      value: this.vpc.publicSubnets.map((s) => s.subnetId).join(','),
      description: 'Public Subnet IDs',
    });

    new cdk.CfnOutput(this, 'PrivateSubnets', {
      value: this.vpc.privateSubnets.map((s) => s.subnetId).join(','),
      description: 'Private Subnet IDs',
    });
  }
}
