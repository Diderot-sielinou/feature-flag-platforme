import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

/**
 * Stack dédiée à la création des dépôts ECR.
 *
 * IMPORTANT: Cette stack est séparée pour permettre:
 * 1. Déployer ECR d'abord
 * 2. Build et push des images Docker
 * 3. Puis déployer ComputeStack avec les images
 *
 * Cela résout le problème du "chicken and egg" où ECS
 * a besoin d'images qui n'existent pas encore.
 */
export class ECRStack extends cdk.Stack {
  public readonly managementRepo: ecr.Repository;
  public readonly readRepo: ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // Repository pour l'API de Management
    // ========================================
    this.managementRepo = new ecr.Repository(this, 'ManagementAPIRepo', {
      repositoryName: 'feature-flags/api-management',

      // Politique de suppression (DESTROY pour dev, RETAIN pour prod)
      removalPolicy: cdk.RemovalPolicy.DESTROY,

      // Scan automatique des vulnérabilités
      imageScanOnPush: true,

      // Politique de cycle de vie pour limiter les coûts de stockage
      lifecycleRules: [
        {
          description: 'Delete untagged images after 1 day',
          maxImageAge: cdk.Duration.days(1),
          rulePriority: 1, // CORRIGÉ : Priorité 1 (la plus haute) pour les UNTAGGED
          tagStatus: ecr.TagStatus.UNTAGGED,
        },
        {
          description: 'Keep last 10 images (ANY Tag Status)',
          maxImageCount: 10,
          rulePriority: 2, // CORRIGÉ : Priorité 2 (la plus basse) pour la règle ANY implicite
          // tagStatus: ecr.TagStatus.ANY (implicite si non spécifié, mais doit avoir la priorité la plus basse)
        },
      ],

      // Tag immutability (optionnel, désactivé pour dev)
      imageTagMutability: ecr.TagMutability.MUTABLE,
    });

    // ========================================
    // Repository pour l'API de Lecture
    // ========================================
    this.readRepo = new ecr.Repository(this, 'ReadAPIRepo', {
      repositoryName: 'feature-flags/api-read',

      removalPolicy: cdk.RemovalPolicy.DESTROY,
      imageScanOnPush: true,

      lifecycleRules: [
        {
          description: 'Delete untagged images after 1 day',
          maxImageAge: cdk.Duration.days(1),
          rulePriority: 1, // CORRIGÉ : Priorité 1
          tagStatus: ecr.TagStatus.UNTAGGED,
        },
        {
          description: 'Keep last 10 images (ANY Tag Status)',
          maxImageCount: 10,
          rulePriority: 2, // CORRIGÉ : Priorité 2
        },
      ],

      imageTagMutability: ecr.TagMutability.MUTABLE,
    });

    // ========================================
    // Outputs pour les scripts de déploiement
    // ========================================
    new cdk.CfnOutput(this, 'ManagementRepoURI', {
      value: this.managementRepo.repositoryUri,
      description: 'ECR URI for Management API',
      exportName: 'FeatureFlagsManagementRepoURI',
    });

    new cdk.CfnOutput(this, 'ManagementRepoName', {
      value: this.managementRepo.repositoryName,
      description: 'ECR Repository Name for Management API',
      exportName: 'FeatureFlagsManagementRepoName',
    });

    new cdk.CfnOutput(this, 'ReadRepoURI', {
      value: this.readRepo.repositoryUri,
      description: 'ECR URI for Read API',
      exportName: 'FeatureFlagsReadRepoURI',
    });

    new cdk.CfnOutput(this, 'ReadRepoName', {
      value: this.readRepo.repositoryName,
      description: 'ECR Repository Name for Read API',
      exportName: 'FeatureFlagsReadRepoName',
    });

    // Instructions pour le push des images
    new cdk.CfnOutput(this, 'DockerLoginCommand', {
      value: `aws ecr get-login-password --region ${cdk.Aws.REGION} | docker login --username AWS --password-stdin ${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com`,
      description: 'Command to login to ECR',
    });

    new cdk.CfnOutput(this, 'PushManagementCommand', {
      value: `docker build -t ${this.managementRepo.repositoryUri}:latest -f apps/api-management/Dockerfile . && docker push ${this.managementRepo.repositoryUri}:latest`,
      description: 'Command to build and push Management API image',
    });

    new cdk.CfnOutput(this, 'PushReadCommand', {
      value: `docker build -t ${this.readRepo.repositoryUri}:latest -f apps/api-read/Dockerfile . && docker push ${this.readRepo.repositoryUri}:latest`,
      description: 'Command to build and push Read API image',
    });
  }
}
