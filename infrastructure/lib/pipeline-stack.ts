// infrastructure/lib/pipeline-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface PipelineStackProps extends cdk.StackProps {
  readonly repositoryOwner: string;
  readonly repositoryName: string;
  readonly branch?: string;
  /** Secret name or ARN in SecretsManager that contains the GitHub PAT */
  readonly githubTokenSecretArn: string;

  readonly managementEcr: ecr.IRepository;
  readonly readEcr: ecr.IRepository;

  readonly managementService: ecs.IBaseService;
  readonly readService: ecs.IBaseService;
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const branch = props.branch ?? 'main';

    // Pipeline artifact buckets / objects will be managed by CodePipeline by default
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    // 1) Source (GitHub)
    const sourceAction = new actions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: props.repositoryOwner,
      repo: props.repositoryName,
      branch,
      oauthToken: cdk.SecretValue.secretsManager(props.githubTokenSecretArn),
      output: sourceOutput,
      trigger: actions.GitHubTrigger.WEBHOOK,
    });

    // 2) Build (CodeBuild) - build Docker images, tag, push, create imagedefinitions
    const buildProject = new codebuild.PipelineProject(this, 'BuildAndPushProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true, // required for Docker
        environmentVariables: {
          MANAGEMENT_ECR: { value: props.managementEcr.repositoryUri },
          READ_ECR: { value: props.readEcr.repositoryUri },
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        env: {
          'exported-variables': ['IMAGE_TAG'],
        },
        phases: {
          install: {
            commands: ['echo Installing dependencies with npm...', 'npm ci'],
          },
          pre_build: {
            commands: [
              'echo Logging in to ECR...',
              'ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)',
              'REGION=${AWS_REGION:-' + this.region + '}',
              'MANAGEMENT_REGISTRY=${MANAGEMENT_ECR%/*}',
              'aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $MANAGEMENT_REGISTRY',
            ],
          },
          build: {
            commands: [
              'echo Building Docker images...',
              'docker build -t management-service -f docker/api-management.Dockerfile .',
              'docker build -t read-service -f docker/api-read.Dockerfile .',
              'docker tag management-service:latest $MANAGEMENT_ECR:latest',
              'docker tag read-service:latest $READ_ECR:latest',
            ],
          },
          post_build: {
            commands: [
              'echo Pushing images...',
              'docker push $MANAGEMENT_ECR:latest',
              'docker push $READ_ECR:latest',

              'IMAGE_TAG=$CODEBUILD_RESOLVED_SOURCE_VERSION',
              'echo "IMAGE_TAG=$IMAGE_TAG"',

              'docker tag $MANAGEMENT_ECR:latest $MANAGEMENT_ECR:$IMAGE_TAG',
              'docker tag $READ_ECR:latest $READ_ECR:$IMAGE_TAG',

              'docker push $MANAGEMENT_ECR:$IMAGE_TAG',
              'docker push $READ_ECR:$IMAGE_TAG',

              'printf \'[{"name":"management-service","imageUri":"%s"}]\' "$MANAGEMENT_ECR:$IMAGE_TAG" > management-imagedefinitions.json',
              'printf \'[{"name":"read-service","imageUri":"%s"}]\' "$READ_ECR:$IMAGE_TAG" > read-imagedefinitions.json',
            ],
          },
        },
        artifacts: {
          files: ['management-imagedefinitions.json', 'read-imagedefinitions.json'],
        },
      }),
    });

    // Allow CodeBuild to push/pull the repos
    props.managementEcr.grantPullPush(buildProject.role!);
    props.readEcr.grantPullPush(buildProject.role!);

    // Allow CodeBuild to read SecretsManager token if needed
    buildProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.githubTokenSecretArn],
      }),
    );

    // 3) Pipeline role (we create a role and pass to pipeline so we can attach ECS permissions)
    const pipelineRole = new iam.Role(this, 'CodePipelineRole', {
      assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
    });

    pipelineRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'ecs:DescribeServices',
          'ecs:UpdateService',
          'ecs:DescribeTaskDefinition',
          'ecs:RegisterTaskDefinition',
          'iam:PassRole',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'ecr:GetAuthorizationToken',
        ],
        resources: ['*'], // scope down if you want (cluster/service ARNs)
      }),
    );

    // 4) Build Action
    const buildAction = new actions.CodeBuildAction({
      actionName: 'Build_Docker_Images',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    // 5) Deploy Actions: rolling update using EcsDeployAction (accepts IBaseService)
    const deployManagement = new actions.EcsDeployAction({
      actionName: 'Deploy_Management_Service',
      service: props.managementService,
      input: buildOutput,
      imageFile: new codepipeline.ArtifactPath(buildOutput, 'management-imagedefinitions.json'),
    });

    const deployRead = new actions.EcsDeployAction({
      actionName: 'Deploy_Read_Service',
      service: props.readService,
      input: buildOutput,
      imageFile: new codepipeline.ArtifactPath(buildOutput, 'read-imagedefinitions.json'),
    });

    // 6) Pipeline assembly
    new codepipeline.Pipeline(this, 'FeatureFlagsPipeline', {
      pipelineName: 'FeatureFlagsPipeline',
      role: pipelineRole,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        {
          stageName: 'Build',
          actions: [buildAction],
        },
        {
          stageName: 'Deploy',
          actions: [deployManagement, deployRead],
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'PipelineName', {
      value: 'FeatureFlagsPipeline',
    });
    new cdk.CfnOutput(this, 'ManagementECR', {
      value: props.managementEcr.repositoryUri,
    });
    new cdk.CfnOutput(this, 'ReadECR', {
      value: props.readEcr.repositoryUri,
    });
  }
}
