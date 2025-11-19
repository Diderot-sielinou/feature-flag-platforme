import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

/**
 * Stack dédiée à la création des dépôts ECR.
 * Cela permet de découpler la création des dépôts de la stack ECS,
 * facilitant les étapes de build et de push Docker intermédiaires.
 */
export class ECRStack extends cdk.Stack {
  public readonly managementRepo: ecr.Repository;
  public readonly readRepo: ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Dépôt pour l'API de Management
    this.managementRepo = new ecr.Repository(this, 'ManagementAPIRepo', {
      repositoryName: 'feature-flags/api-management',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
        },
      ],
    });

    // Dépôt pour l'API de Lecture
    this.readRepo = new ecr.Repository(this, 'ReadAPIRepo', {
      repositoryName: 'feature-flags/api-read',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
        },
      ],
    });

    // Outputs pour le script de déploiement (deploy.sh)
    new cdk.CfnOutput(this, 'ManagementRepoURI', {
      value: this.managementRepo.repositoryUri,
      exportName: 'FeatureFlagsManagementRepoURI',
    });

    new cdk.CfnOutput(this, 'ReadRepoURI', {
      value: this.readRepo.repositoryUri,
      exportName: 'FeatureFlagsReadRepoURI',
    });
  }
}
