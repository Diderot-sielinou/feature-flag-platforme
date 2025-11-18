import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

/**
 * Stack dédié uniquement aux repositories ECR
 * À déployer EN PREMIER avant les images Docker
 */
export class ECRStack extends cdk.Stack {
  public readonly managementRepo: ecr.Repository;
  public readonly readRepo: ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // ECR Repository - Management API
    // ========================================
    this.managementRepo = new ecr.Repository(this, 'ManagementAPIRepo', {
      repositoryName: 'feature-flags/api-management',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // ⚠️ DESTROY pour faciliter les tests
      emptyOnDelete: true, // Supprime automatiquement les images lors de la destruction
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      lifecycleRules: [
        {
          description: 'Keep last 10 images only',
          maxImageCount: 10,
          rulePriority: 1,
        },
        {
          description: 'Remove untagged images after 1 day',
          maxImageAge: cdk.Duration.days(1),
          rulePriority: 2,
          tagStatus: ecr.TagStatus.UNTAGGED,
        },
      ],
    });

    // ========================================
    // ECR Repository - Read API
    // ========================================
    this.readRepo = new ecr.Repository(this, 'ReadAPIRepo', {
      repositoryName: 'feature-flags/api-read',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      lifecycleRules: [
        {
          description: 'Keep last 10 images only',
          maxImageCount: 10,
          rulePriority: 1,
        },
        {
          description: 'Remove untagged images after 1 day',
          maxImageAge: cdk.Duration.days(1),
          rulePriority: 2,
          tagStatus: ecr.TagStatus.UNTAGGED,
        },
      ],
    });

    // ========================================
    // Outputs pour faciliter les builds Docker
    // ========================================
    new cdk.CfnOutput(this, 'ManagementRepoURI', {
      value: this.managementRepo.repositoryUri,
      description: 'URI du repository ECR Management API',
      exportName: 'FeatureFlagsManagementRepoURI',
    });

    new cdk.CfnOutput(this, 'ManagementRepoName', {
      value: this.managementRepo.repositoryName,
      description: 'Nom du repository Management API',
      exportName: 'FeatureFlagsManagementRepoName',
    });

    new cdk.CfnOutput(this, 'ReadRepoURI', {
      value: this.readRepo.repositoryUri,
      description: 'URI du repository ECR Read API',
      exportName: 'FeatureFlagsReadRepoURI',
    });

    new cdk.CfnOutput(this, 'ReadRepoName', {
      value: this.readRepo.repositoryName,
      description: 'Nom du repository Read API',
      exportName: 'FeatureFlagsReadRepoName',
    });

    new cdk.CfnOutput(this, 'LoginCommand', {
      value: `aws ecr get-login-password --region ${cdk.Aws.REGION} | docker login --username AWS --password-stdin ${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com`,
      description: 'Commande pour se connecter à ECR',
    });

    // ========================================
    // Tags
    // ========================================
    cdk.Tags.of(this).add('Component', 'ECR');
    cdk.Tags.of(this).add('Purpose', 'DockerImageStorage');
  }
}
