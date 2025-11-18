import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  databaseSecurityGroup: ec2.SecurityGroup;
  cacheSecurityGroup: ec2.SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  public readonly dbInstance: rds.DatabaseInstance;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly redisCluster: elasticache.CfnReplicationGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // Secret pour les credentials de la base de données (inchangé)
    this.dbSecret = new secretsmanager.Secret(this, 'DBSecret', {
      secretName: 'feature-flags/db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'ffadmin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    // RDS PostgreSQL - AJUSTÉ POUR FREE TIER
    this.dbInstance = new rds.DatabaseInstance(this, 'PostgreSQLInstance', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      // 🚨 CORRECTION: Passer à T3.MICRO (Free Tier)
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [props.databaseSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      databaseName: 'featureflags',
      multiAz: false, // Correct pour Free Tier
      allocatedStorage: 20, // 20GB est la limite minimale/Free Tier
      maxAllocatedStorage: 100, // Une limite plus raisonnable
      backupRetention: cdk.Duration.days(1), // Correct pour Free Tier
      deletionProtection: false, // Désactivé pour faciliter les suppressions/tests
      storageEncrypted: true,
      enablePerformanceInsights: false, // Désactivé pour Free Tier
      // performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
    });

    // Subnet Group pour ElastiCache (inchangé)
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cluster',
      subnetIds: props.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnetIds,
    });

    // ElastiCache Redis Cluster - AJUSTÉ POUR FREE TIER
    this.redisCluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
      replicationGroupDescription: 'Feature Flags Redis Cluster',
      engine: 'redis',
      // 🚨 CORRECTION: Passer à cache.t3.micro (Free Tier)
      cacheNodeType: 'cache.t3.micro',
      // 🚨 CORRECTION: Un seul cluster (Free Tier)
      numCacheClusters: 1,
      // 🚨 CORRECTION: Désactiver pour un seul cluster
      automaticFailoverEnabled: false,
      multiAzEnabled: false, // Désactiver pour un seul cluster
      cacheSubnetGroupName: subnetGroup.ref,
      securityGroupIds: [props.cacheSecurityGroup.securityGroupId],
      atRestEncryptionEnabled: false,
      transitEncryptionEnabled: false,
      engineVersion: '7.0',
      snapshotRetentionLimit: 0, // Désactiver la rétention pour Free Tier
    });

    // ⚠️ AJOUT: Politique de suppression pour éviter les blocages de rollback
    this.redisCluster.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Outputs (inchangés)
    new cdk.CfnOutput(this, 'DBEndpoint', {
      value: this.dbInstance.dbInstanceEndpointAddress,
      exportName: 'FeatureFlagsDBEndpoint',
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisCluster.attrPrimaryEndPointAddress,
      exportName: 'FeatureFlagsRedisEndpoint',
    });

    new cdk.CfnOutput(this, 'DBSecretArn', {
      value: this.dbSecret.secretArn,
      exportName: 'FeatureFlagsDBSecretArn',
    });
  }
}
