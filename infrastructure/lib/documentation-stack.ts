import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';

interface DocumentationStackProps extends cdk.StackProps {
  domainName?: string;
  certificateArn?: string;
  hostedZoneId?: string;
  cacheTtl?: cdk.Duration;
}

export class DocumentationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DocumentationStackProps) {
    super(scope, id, props);

    // ------------------------------
    // 1) S3 Bucket
    // ------------------------------
    const bucket = new s3.Bucket(this, 'DocsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ------------------------------
    // 2) OAI
    // ------------------------------
    const oai = new cloudfront.OriginAccessIdentity(this, 'DocsOAI');
    bucket.grantRead(oai);

    // ------------------------------
    // 3) Cache policies
    // ------------------------------
    const assetsCachePolicy = new cloudfront.CachePolicy(this, 'DocsAssetsCachePolicy', {
      minTtl: props.cacheTtl ?? cdk.Duration.hours(1),
      defaultTtl: props.cacheTtl ?? cdk.Duration.hours(1),
      maxTtl: cdk.Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const htmlCachePolicy = new cloudfront.CachePolicy(this, 'DocsHtmlCachePolicy', {
      minTtl: cdk.Duration.seconds(0),
      defaultTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(0),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // ------------------------------
    // 4) Cert + Domain
    // ------------------------------
    let certificate;
    let hostedZone;

    if (props.domainName && props.certificateArn && props.hostedZoneId) {
      certificate = acm.Certificate.fromCertificateArn(this, 'DocsCert', props.certificateArn);

      hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'DocsHostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domainName.split('.').slice(-2).join('.'),
      });
    }

    // ------------------------------
    // 5) CloudFront distribution
    // ------------------------------
    const distribution = new cloudfront.Distribution(this, 'DocsDistribution', {
      defaultRootObject: 'index.html',

      defaultBehavior: {
        origin: new origins.S3Origin(bucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: htmlCachePolicy,
        compress: true,
      },

      additionalBehaviors: {
        'assets/*': {
          origin: new origins.S3Origin(bucket, { originAccessIdentity: oai }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: assetsCachePolicy,
          compress: true,
        },
        'static/*': {
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
      new route53.ARecord(this, 'DocsAliasRecord', {
        zone: hostedZone,
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });
    }

    // ------------------------------
    // 7) Deploy static documentation
    // ------------------------------
    new s3deploy.BucketDeployment(this, 'DeployDocs', {
      destinationBucket: bucket,
      sources: [s3deploy.Source.asset('../apps/docs/build')],
      distribution,
      distributionPaths: ['/*'],
      prune: true,
    });

    // ------------------------------
    // 8) Outputs
    // ------------------------------
    new cdk.CfnOutput(this, 'DocumentationURL', {
      value: props.domainName
        ? `https://${props.domainName}`
        : `https://${distribution.domainName}`,
    });
  }
}
