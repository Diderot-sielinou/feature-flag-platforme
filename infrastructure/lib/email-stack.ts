import * as cdk from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface EmailStackProps extends cdk.StackProps {
  /**
   * Email address to verify and use as sender
   * Required when not using a custom domain
   */
  senderEmail: string;

  /**
   * Custom domain for sending emails (optional)
   * If not provided, will use email identity instead
   */
  domainName?: string;
}

/**
 * Stack responsable de l'envoi d'emails via Amazon SES:
 * - Email Identity (adresse email vérifiée)
 * - Configuration Set pour le tracking
 * - Templates d'emails
 * - IAM Policy pour les services
 *
 * IMPORTANT: Après le déploiement, vous devez vérifier votre email
 * en cliquant sur le lien envoyé par AWS SES.
 *
 * Note: Par défaut, SES est en mode "sandbox" qui limite les destinataires
 * aux adresses vérifiées. Pour envoyer à n'importe qui, demandez
 * une sortie du sandbox via la console AWS.
 */
export class EmailStack extends cdk.Stack {
  public readonly emailIdentityArn: string;
  public readonly configurationSet: ses.ConfigurationSet;
  public readonly sendEmailPolicy: iam.PolicyStatement;

  constructor(scope: Construct, id: string, props: EmailStackProps) {
    super(scope, id, props);

    // ========================================
    // Configuration Set
    // Permet le tracking des emails (bounces, complaints, etc.)
    // ========================================
    this.configurationSet = new ses.ConfigurationSet(this, 'EmailConfigSet', {
      configurationSetName: 'feature-flags-emails',

      // Tracking options
      reputationMetrics: true,
      sendingEnabled: true,

      // TLS policy
      tlsPolicy: ses.ConfigurationSetTlsPolicy.REQUIRE,
    });

    // ========================================
    // Email Identity
    // Soit un domaine entier, soit une adresse email spécifique
    // ========================================
    let emailIdentity: ses.EmailIdentity;

    if (props.domainName) {
      // Identity basée sur un domaine (nécessite configuration DNS)
      emailIdentity = new ses.EmailIdentity(this, 'DomainIdentity', {
        identity: ses.Identity.domain(props.domainName),
        configurationSet: this.configurationSet,
      });

      this.emailIdentityArn = `arn:aws:ses:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:identity/${props.domainName}`;

      new cdk.CfnOutput(this, 'DKIMRecords', {
        value: 'Check AWS Console for DKIM DNS records to add to your domain',
        description: 'DKIM DNS records for domain verification',
      });
    } else {
      // Identity basée sur une adresse email (plus simple pour commencer)
      emailIdentity = new ses.EmailIdentity(this, 'EmailAddressIdentity', {
        identity: ses.Identity.email(props.senderEmail),
        configurationSet: this.configurationSet,
      });

      this.emailIdentityArn = `arn:aws:ses:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:identity/${props.senderEmail}`;
    }

    // ========================================
    // Email Templates
    // ========================================

    // Template: Invitation à un projet
    new ses.CfnTemplate(this, 'InvitationTemplate', {
      template: {
        templateName: 'feature-flags-invitation',
        subjectPart: 'You have been invited to {{projectName}} on LaunchLayer',
        htmlPart: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Invitation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    .role-badge { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 9999px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 LaunchLayer</h1>
      <p>Feature Flags Platform</p>
    </div>
    <div class="content">
      <h2>You've been invited!</h2>
      <p>Hello,</p>
      <p><strong>{{inviterName}}</strong> has invited you to join the project <strong>{{projectName}}</strong> on LaunchLayer.</p>
      <p>Your role: <span class="role-badge">{{role}}</span></p>
      <p>Click the button below to accept the invitation:</p>
      <a href="{{invitationUrl}}" class="button">Accept Invitation</a>
      <p>This invitation will expire in 7 days.</p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>© {{year}} LaunchLayer. All rights reserved.</p>
      <p>This email was sent by LaunchLayer Feature Flags Platform.</p>
    </div>
  </div>
</body>
</html>`,
        textPart: `
You've been invited to {{projectName}} on LaunchLayer!

Hello,

{{inviterName}} has invited you to join the project "{{projectName}}" with the role: {{role}}.

Click the link below to accept the invitation:
{{invitationUrl}}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

---
LaunchLayer - Feature Flags Platform
`,
      },
    });

    // Template: Changement de flag (notification)
    new ses.CfnTemplate(this, 'FlagChangeTemplate', {
      template: {
        templateName: 'feature-flags-flag-change',
        subjectPart: '[{{projectName}}] Flag "{{flagKey}}" was {{action}}',
        htmlPart: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1f2937; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .change-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .label { color: #6b7280; font-size: 12px; text-transform: uppercase; }
    .value { font-weight: 600; font-size: 16px; }
    .enabled { color: #059669; }
    .disabled { color: #dc2626; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🏴 Flag Change Notification</h2>
    </div>
    <div class="content">
      <div class="change-box">
        <p class="label">Project</p>
        <p class="value">{{projectName}}</p>
      </div>
      <div class="change-box">
        <p class="label">Flag</p>
        <p class="value">{{flagKey}}</p>
      </div>
      <div class="change-box">
        <p class="label">Environment</p>
        <p class="value">{{environment}}</p>
      </div>
      <div class="change-box">
        <p class="label">Action</p>
        <p class="value">{{action}}</p>
      </div>
      <div class="change-box">
        <p class="label">Changed by</p>
        <p class="value">{{changedBy}}</p>
      </div>
      <div class="change-box">
        <p class="label">Time</p>
        <p class="value">{{timestamp}}</p>
      </div>
    </div>
  </div>
</body>
</html>`,
        textPart: `
Flag Change Notification

Project: {{projectName}}
Flag: {{flagKey}}
Environment: {{environment}}
Action: {{action}}
Changed by: {{changedBy}}
Time: {{timestamp}}

---
LaunchLayer - Feature Flags Platform
`,
      },
    });

    // Template: Bienvenue après inscription
    new ses.CfnTemplate(this, 'WelcomeTemplate', {
      template: {
        templateName: 'feature-flags-welcome',
        subjectPart: 'Welcome to LaunchLayer! 🚀',
        htmlPart: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .feature { display: flex; align-items: flex-start; margin: 15px 0; }
    .feature-icon { font-size: 24px; margin-right: 15px; }
    .feature-text h4 { margin: 0 0 5px 0; }
    .feature-text p { margin: 0; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 Welcome to LaunchLayer!</h1>
      <p>Your Feature Flags journey starts here</p>
    </div>
    <div class="content">
      <h2>Hello {{userName}}!</h2>
      <p>Thank you for joining LaunchLayer. We're excited to have you on board!</p>
      
      <h3>Here's what you can do:</h3>
      
      <div class="feature">
        <span class="feature-icon">🏴</span>
        <div class="feature-text">
          <h4>Create Feature Flags</h4>
          <p>Control feature rollouts without deploying code</p>
        </div>
      </div>
      
      <div class="feature">
        <span class="feature-icon">🎯</span>
        <div class="feature-text">
          <h4>Target Users</h4>
          <p>Use segments and rules to target specific users</p>
        </div>
      </div>
      
      <div class="feature">
        <span class="feature-icon">📊</span>
        <div class="feature-text">
          <h4>A/B Testing</h4>
          <p>Run experiments with multivariate flags</p>
        </div>
      </div>
      
      <div class="feature">
        <span class="feature-icon">⏰</span>
        <div class="feature-text">
          <h4>Schedule Releases</h4>
          <p>Plan flag changes for specific times</p>
        </div>
      </div>
      
      <a href="{{dashboardUrl}}" class="button">Go to Dashboard</a>
      
      <p>Need help? Check out our <a href="{{docsUrl}}">documentation</a> or reply to this email.</p>
    </div>
  </div>
</body>
</html>`,
        textPart: `
Welcome to LaunchLayer!

Hello {{userName}}!

Thank you for joining LaunchLayer. We're excited to have you on board!

Here's what you can do:
- Create Feature Flags: Control feature rollouts without deploying code
- Target Users: Use segments and rules to target specific users
- A/B Testing: Run experiments with multivariate flags
- Schedule Releases: Plan flag changes for specific times

Go to Dashboard: {{dashboardUrl}}

Need help? Check out our documentation: {{docsUrl}}

---
LaunchLayer - Feature Flags Platform
`,
      },
    });

    // ========================================
    // IAM Policy for sending emails
    // Cette policy sera attachée aux Task Roles ECS
    // ========================================
    this.sendEmailPolicy = new iam.PolicyStatement({
      sid: 'AllowSendEmail',
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail',
        'ses:SendTemplatedEmail',
        'ses:SendBulkTemplatedEmail',
      ],
      resources: [
        this.emailIdentityArn,
        `arn:aws:ses:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:configuration-set/${this.configurationSet.configurationSetName}`,
      ],
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'SenderEmail', {
      value: props.senderEmail,
      description: 'Verified sender email address',
      exportName: 'FeatureFlagsSenderEmail',
    });

    new cdk.CfnOutput(this, 'EmailIdentityArn', {
      value: this.emailIdentityArn,
      description: 'SES Email Identity ARN',
      exportName: 'FeatureFlagsEmailIdentityArn',
    });

    new cdk.CfnOutput(this, 'ConfigurationSetName', {
      value: this.configurationSet.configurationSetName,
      description: 'SES Configuration Set Name',
      exportName: 'FeatureFlagsEmailConfigSet',
    });

    new cdk.CfnOutput(this, 'VerificationInstructions', {
      value: `IMPORTANT: Check your email (${props.senderEmail}) and click the verification link from AWS SES`,
      description: 'Instructions for email verification',
    });

    new cdk.CfnOutput(this, 'SandboxNote', {
      value:
        'SES is in sandbox mode by default. Request production access via AWS Console to send to unverified addresses.',
      description: 'Note about SES sandbox mode',
    });
  }
}
