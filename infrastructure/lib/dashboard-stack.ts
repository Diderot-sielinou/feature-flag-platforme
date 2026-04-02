import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';

interface DashboardStackProps extends cdk.StackProps {
  apiManagementBaseUrl: string;
  domainName?: string;
  certificateArn?: string;
  hostedZoneId?: string;
  cacheTtl?: cdk.Duration;
}

export class DashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DashboardStackProps) {
    super(scope, id, props);

    // ------------------------------
    // 1) S3 BUCKET
    // ------------------------------
    const bucket = new s3.Bucket(this, 'DashboardBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ------------------------------
    // 2) OAI (Origin Access Identity)
    // ------------------------------
    const oai = new cloudfront.OriginAccessIdentity(this, 'DashboardOAI');
    bucket.grantRead(oai);

    // ------------------------------
    // 3) CACHE POLICIES
    // ------------------------------
    const assetsCachePolicy = new cloudfront.CachePolicy(this, 'AssetsCachePolicy', {
      minTtl: props.cacheTtl ?? cdk.Duration.hours(1),
      defaultTtl: props.cacheTtl ?? cdk.Duration.hours(1),
      maxTtl: cdk.Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const spaCachePolicy = new cloudfront.CachePolicy(this, 'SPACachePolicy', {
      minTtl: cdk.Duration.seconds(0),
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(0),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // ------------------------------
    // 4) CERTIFICATE + DOMAIN
    // ------------------------------
    let certificate;
    let hostedZone;

    if (props.domainName && props.certificateArn && props.hostedZoneId) {
      certificate = acm.Certificate.fromCertificateArn(this, 'DashboardCert', props.certificateArn);

      hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'DashboardHostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domainName.split('.').slice(-2).join('.'),
      });
    }

    // ------------------------------
    // 5) CLOUDFRONT DISTRIBUTION
    // ------------------------------
    const distribution = new cloudfront.Distribution(this, 'DashboardDistribution', {
      defaultRootObject: 'index.html',

      defaultBehavior: {
        origin: new origins.S3Origin(bucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: spaCachePolicy,
        compress: true,
      },

      additionalBehaviors: {
        '_next/static/*': {
          origin: new origins.S3Origin(bucket, { originAccessIdentity: oai }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: assetsCachePolicy,
          compress: true,
        },
      },

      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],

      domainNames: props.domainName ? [props.domainName] : undefined,
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // ------------------------------
    // 6) DNS
    // ------------------------------
    if (props.domainName && hostedZone) {
      new route53.ARecord(this, 'DashboardAliasRecord', {
        zone: hostedZone,
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
    }

    // ------------------------------
    // 7) DEPLOY STATIC FILES
    // ------------------------------

    const envConfig = `window.env = { API_BASE_URL: "${props.apiManagementBaseUrl}" };`;

    new s3deploy.BucketDeployment(this, 'DeployDashboard', {
      destinationBucket: bucket,
      sources: [
        s3deploy.Source.asset('../apps/dashboard/out'),
        s3deploy.Source.data('env-config.js', envConfig),
      ],
      distribution,
      distributionPaths: ['/*'],
      prune: true,
    });

    // ------------------------------
    // 8) OUTPUTS
    // ------------------------------
    new cdk.CfnOutput(this, 'DashboardURL', {
      value: props.domainName
        ? `https://${props.domainName}`
        : `https://${distribution.domainName}`,
    });
    new cdk.CfnOutput(this, 'DashboardBucketName', {
      value: bucket.bucketName,
      description: 'Nom du bucket S3 du dashboard',
    });
  }
}
