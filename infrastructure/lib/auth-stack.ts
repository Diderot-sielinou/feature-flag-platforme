import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

/**
 * Stack responsable de l'authentification:
 * - Cognito User Pool pour la gestion des utilisateurs
 * - App Clients pour le Dashboard et l'API
 * - Hosted UI pour l'authentification
 */
export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly apiClient: cognito.UserPoolClient;
  public readonly domain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // Cognito User Pool
    // ========================================
    this.userPool = new cognito.UserPool(this, 'FeatureFlagsUserPool', {
      userPoolName: 'feature-flags-users',

      // Self Sign-up
      selfSignUpEnabled: true,

      // Sign-in options
      signInAliases: {
        email: true,
        username: false,
      },

      // Verification
      autoVerify: {
        email: true,
      },

      // Standard attributes
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },

      // Custom attributes
      customAttributes: {
        tenant_id: new cognito.StringAttribute({ mutable: true }),
        role: new cognito.StringAttribute({ mutable: true }),
      },

      // Password policy - sécurisée
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },

      // Account recovery
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      // MFA - optionnel pour ne pas bloquer les utilisateurs
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false, // Désactivé pour réduire les coûts SMS
        otp: true, // TOTP gratuit
      },

      // Email verification
      userVerification: {
        emailSubject: 'Verify your email for LaunchLayer',
        emailBody: `
          <h2>Welcome to LaunchLayer!</h2>
          <p>Hello {username},</p>
          <p>Your verification code is: <strong>{####}</strong></p>
          <p>This code will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
          <br/>
          <p>Best regards,<br/>The LaunchLayer Team</p>
        `,
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },

      // Invite message
      userInvitation: {
        emailSubject: 'You have been invited to LaunchLayer',
        emailBody: `
          <h2>Welcome to LaunchLayer!</h2>
          <p>Hello {username},</p>
          <p>You have been invited to join a project on LaunchLayer.</p>
          <p>Your temporary password is: <strong>{####}</strong></p>
          <p>Please sign in and change your password.</p>
          <br/>
          <p>Best regards,<br/>The LaunchLayer Team</p>
        `,
      },

      // Retention policy
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Protect user data
    });

    // ========================================
    // User Pool Client - Dashboard (Web App)
    // ========================================
    this.userPoolClient = new cognito.UserPoolClient(this, 'DashboardClient', {
      userPool: this.userPool,
      userPoolClientName: 'dashboard-client',

      // Auth flows
      authFlows: {
        userPassword: true,
        userSrp: true,
      },

      // OAuth settings
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        // Callback URLs - à configurer selon votre domaine
        callbackUrls: [
          'http://localhost:3000/auth/callback',
          'http://localhost:3000/api/auth/callback/cognito',
        ],
        logoutUrls: ['http://localhost:3000', 'http://localhost:3000/auth/logout'],
      },

      // Security
      preventUserExistenceErrors: true,

      // Token validity
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      // Generate client secret
      generateSecret: false, // Pas de secret pour les apps web SPA
    });

    // ========================================
    // User Pool Client - API (Server-to-Server)
    // ========================================
    this.apiClient = new cognito.UserPoolClient(this, 'APIClient', {
      userPool: this.userPool,
      userPoolClientName: 'api-client',

      // Auth flows
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true,
      },

      // Security
      preventUserExistenceErrors: true,

      // Token validity - plus court pour l'API
      accessTokenValidity: cdk.Duration.minutes(30),
      idTokenValidity: cdk.Duration.minutes(30),
      refreshTokenValidity: cdk.Duration.days(7),

      // Generate client secret pour server-to-server
      generateSecret: true,
    });

    // ========================================
    // Cognito Domain (Hosted UI)
    // ========================================
    this.domain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: `feature-flags-${cdk.Aws.ACCOUNT_ID}`,
      },
    });

    // ========================================
    // User Pool Groups (Roles)
    // ========================================
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Admins',
      description: 'Platform administrators with full access',
      precedence: 0,
    });

    new cognito.CfnUserPoolGroup(this, 'OwnersGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Owners',
      description: 'Project owners with full project access',
      precedence: 10,
    });

    new cognito.CfnUserPoolGroup(this, 'EditorsGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Editors',
      description: 'Project editors with limited access',
      precedence: 20,
    });

    new cognito.CfnUserPoolGroup(this, 'ViewersGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Viewers',
      description: 'Read-only access',
      precedence: 30,
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'FeatureFlagsUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: 'FeatureFlagsUserPoolArn',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Dashboard Client ID',
      exportName: 'FeatureFlagsUserPoolClientId',
    });

    new cdk.CfnOutput(this, 'APIClientId', {
      value: this.apiClient.userPoolClientId,
      description: 'API Client ID',
      exportName: 'FeatureFlagsAPIClientId',
    });

    new cdk.CfnOutput(this, 'CognitoDomainUrl', {
      value: `https://${this.domain.domainName}.auth.${cdk.Aws.REGION}.amazoncognito.com`,
      description: 'Cognito Hosted UI Domain',
      exportName: 'FeatureFlagsCognitoDomain',
    });

    new cdk.CfnOutput(this, 'CognitoIssuerUrl', {
      value: `https://cognito-idp.${cdk.Aws.REGION}.amazonaws.com/${this.userPool.userPoolId}`,
      description: 'Cognito Issuer URL for JWT validation',
      exportName: 'FeatureFlagsCognitoIssuer',
    });
  }
}
