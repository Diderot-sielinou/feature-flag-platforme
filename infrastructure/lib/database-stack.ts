import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  databaseSecurityGroup: ec2.SecurityGroup;
  cacheSecurityGroup: ec2.SecurityGroup;
  isProduction?: boolean;
}

/**
 * Stack responsable des bases de données:
 * - RDS PostgreSQL pour le stockage persistant
 * - ElastiCache Redis pour le cache et les queues
 * - Secrets Manager pour les credentials
 */
export class DatabaseStack extends cdk.Stack {
  public readonly dbInstance: rds.DatabaseInstance;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly redisCluster: elasticache.CfnReplicationGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const isProduction = props.isProduction ?? false;

    // ========================================
    // Secrets Manager - Database Credentials
    // ========================================
    this.dbSecret = new secretsmanager.Secret(this, 'DBSecret', {
      secretName: 'feature-flags/db-credentials',
      description: 'PostgreSQL credentials for Feature Flags Platform',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'ffadmin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // ========================================
    // RDS PostgreSQL
    // ========================================
    // Mode développement: t3.micro (Free Tier), Single-AZ
    // Mode production: t3.small, Multi-AZ
    this.dbInstance = new rds.DatabaseInstance(this, 'PostgreSQLInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      // Free Tier: t3.micro, Production: t3.small ou plus
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        isProduction ? ec2.InstanceSize.SMALL : ec2.InstanceSize.MICRO,
      ),
      instanceIdentifier: 'feature-flags-db',
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [props.databaseSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      databaseName: 'featureflags',

      // Haute disponibilité: uniquement en production
      multiAz: isProduction,

      // Stockage
      allocatedStorage: 20, // 20GB minimum (Free Tier)
      maxAllocatedStorage: isProduction ? 100 : 50,
      storageType: rds.StorageType.GP2,
      storageEncrypted: true,

      // Backups: moins fréquents en dev pour réduire les coûts
      backupRetention: cdk.Duration.days(isProduction ? 7 : 1),
      deleteAutomatedBackups: !isProduction,

      // Performance Insights: uniquement en production
      enablePerformanceInsights: isProduction,
      performanceInsightRetention: isProduction
        ? rds.PerformanceInsightRetention.DEFAULT
        : undefined,

      // Protection contre la suppression accidentelle
      deletionProtection: isProduction,
      removalPolicy: isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,

      // Paramètres supplémentaires
      publiclyAccessible: false,
      autoMinorVersionUpgrade: true,
    });

    // ========================================
    // ElastiCache Redis
    // ========================================

    // Subnet Group pour ElastiCache
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Feature Flags Redis cluster',
      subnetIds: props.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnetIds,
      cacheSubnetGroupName: 'feature-flags-redis-subnet-group',
    });

    // Redis Cluster
    // Mode développement: cache.t3.micro (Free Tier), 1 nœud
    // Mode production: cache.t3.small, 2 nœuds avec failover
    this.redisCluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
      replicationGroupDescription: 'Feature Flags Redis Cluster',
      replicationGroupId: 'feature-flags-redis',

      engine: 'redis',
      engineVersion: '7.0',

      // Free Tier: cache.t3.micro
      cacheNodeType: isProduction ? 'cache.t3.small' : 'cache.t3.micro',

      // Nombre de nœuds
      numCacheClusters: isProduction ? 2 : 1,

      // Haute disponibilité: uniquement en production
      automaticFailoverEnabled: isProduction,
      multiAzEnabled: isProduction,

      // Réseau
      cacheSubnetGroupName: redisSubnetGroup.ref,
      securityGroupIds: [props.cacheSecurityGroup.securityGroupId],

      // Encryption: désactivé en dev pour Free Tier
      atRestEncryptionEnabled: isProduction,
      transitEncryptionEnabled: isProduction,

      // Snapshots: désactivés en dev pour réduire les coûts
      snapshotRetentionLimit: isProduction ? 7 : 0,

      // Port
      port: 6379,
    });

    // Politique de suppression
    this.redisCluster.applyRemovalPolicy(
      isProduction ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    );

    // Dépendance explicite
    this.redisCluster.addDependency(redisSubnetGroup);

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'DBEndpoint', {
      value: this.dbInstance.dbInstanceEndpointAddress,
      description: 'PostgreSQL Endpoint',
      exportName: 'FeatureFlagsDBEndpoint',
    });

    new cdk.CfnOutput(this, 'DBPort', {
      value: this.dbInstance.dbInstanceEndpointPort,
      description: 'PostgreSQL Port',
      exportName: 'FeatureFlagsDBPort',
    });

    new cdk.CfnOutput(this, 'DBSecretArn', {
      value: this.dbSecret.secretArn,
      description: 'Database Credentials Secret ARN',
      exportName: 'FeatureFlagsDBSecretArn',
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisCluster.attrPrimaryEndPointAddress,
      description: 'Redis Primary Endpoint',
      exportName: 'FeatureFlagsRedisEndpoint',
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: this.redisCluster.attrPrimaryEndPointPort,
      description: 'Redis Port',
      exportName: 'FeatureFlagsRedisPort',
    });
  }
}
