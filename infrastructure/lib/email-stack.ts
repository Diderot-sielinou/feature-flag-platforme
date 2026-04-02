// infrastructure/lib/email-stack.ts

import * as cdk from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface EmailStackProps extends cdk.StackProps {
  senderEmail: string;
  domainName?: string; // Pour plus tard
}

export class EmailStack extends cdk.Stack {
  public readonly emailIdentityArn: string;
  public readonly configurationSet: ses.ConfigurationSet;
  public readonly sendEmailPolicy: iam.PolicyStatement;

  constructor(scope: Construct, id: string, props: EmailStackProps) {
    super(scope, id, props);

    // ========================================
    // Configuration Set
    // ========================================
    this.configurationSet = new ses.ConfigurationSet(this, 'EmailConfigSet', {
      configurationSetName: 'feature-flags-emails',
      reputationMetrics: true,
      sendingEnabled: true,
      tlsPolicy: ses.ConfigurationSetTlsPolicy.REQUIRE,
    });

    // ========================================
    // Email Identity (Domain ou Email)
    // ========================================
    if (props.domainName) {
      // Identity basée sur un domaine (production)
      new ses.EmailIdentity(this, 'DomainIdentity', {
        identity: ses.Identity.domain(props.domainName),
        configurationSet: this.configurationSet,
      });

      this.emailIdentityArn = `arn:aws:ses:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:identity/${props.domainName}`;

      new cdk.CfnOutput(this, 'DKIMInstructions', {
        value: 'Check AWS Console → SES → Verified identities → DKIM for DNS records',
        description: 'DKIM configuration instructions',
      });
    } else {
      // Identity basée sur une adresse email (dev/staging)
      new ses.EmailIdentity(this, 'EmailAddressIdentity', {
        identity: ses.Identity.email(props.senderEmail),
        configurationSet: this.configurationSet,
      });

      this.emailIdentityArn = `arn:aws:ses:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:identity/${props.senderEmail}`;
    }

    // ========================================
    // Email Templates (SANS conditionnels)
    // Note: Les templates avec conditionnels sont gérés en code (raw emails)
    // ========================================

    // Template: Welcome (pas de conditionnels)
    new ses.CfnTemplate(this, 'WelcomeTemplate', {
      template: {
        templateName: 'feature-flags-welcome',
        subjectPart: 'Welcome to LaunchLayer! 🚀',
        htmlPart: this.getWelcomeHtmlTemplate(),
        textPart: this.getWelcomeTextTemplate(),
      },
    });

    // Template: Flag Change Notification (pas de conditionnels)
    new ses.CfnTemplate(this, 'FlagChangeTemplate', {
      template: {
        templateName: 'feature-flags-flag-change',
        subjectPart: '[{{projectName}}] Flag "{{flagKey}}" was {{action}}',
        htmlPart: this.getFlagChangeHtmlTemplate(),
        textPart: this.getFlagChangeTextTemplate(),
      },
    });

    // Note: Invitation template est géré en code (EmailService.buildNewUserInvitationHtml)
    // car il nécessite des conditionnels (isNewUser, temporaryPassword)

    // ========================================
    // IAM Policy
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
      description: 'Sender email address',
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

    if (!props.domainName) {
      new cdk.CfnOutput(this, 'VerificationNote', {
        value: `IMPORTANT: Verify ${props.senderEmail} by clicking the link in the AWS SES verification email`,
      });

      new cdk.CfnOutput(this, 'SandboxNote', {
        value: 'SES is in sandbox mode. Request production access to send to unverified addresses.',
      });
    }
  }

  // Templates sans conditionnels (SES compatible)
  private getWelcomeHtmlTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #fff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; color: #fff; font-size: 28px;">🚀 Welcome to LaunchLayer!</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9);">Feature Flags Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; color: #1f2937;">Hello {{userName}}!</h2>
              <p style="color: #4b5563; margin-bottom: 24px;">Thank you for joining LaunchLayer. We're excited to have you!</p>
              
              <h3 style="color: #374151; margin-bottom: 16px;">Here's what you can do:</h3>
              <ul style="color: #4b5563; padding-left: 20px;">
                <li style="margin-bottom: 8px;">🏴 <strong>Create Feature Flags</strong> - Control rollouts without deploying</li>
                <li style="margin-bottom: 8px;">🎯 <strong>Target Users</strong> - Use segments and rules</li>
                <li style="margin-bottom: 8px;">📊 <strong>A/B Testing</strong> - Run experiments with multivariate flags</li>
                <li style="margin-bottom: 8px;">⏰ <strong>Schedule Releases</strong> - Plan flag changes</li>
              </ul>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="{{dashboardUrl}}" style="display: inline-block; background: #667eea; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px;">
                Need help? Check out our <a href="{{docsUrl}}" style="color: #667eea;">documentation</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private getWelcomeTextTemplate(): string {
    return `
Welcome to LaunchLayer!

Hello {{userName}}!

Thank you for joining LaunchLayer. We're excited to have you!

Here's what you can do:
- Create Feature Flags - Control rollouts without deploying
- Target Users - Use segments and rules
- A/B Testing - Run experiments with multivariate flags
- Schedule Releases - Plan flag changes

Go to Dashboard: {{dashboardUrl}}

Need help? Check out our documentation: {{docsUrl}}

---
LaunchLayer - Feature Flags Platform
    `.trim();
  }

  private getFlagChangeHtmlTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #fff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background: #1f2937; padding: 24px; color: #fff;">
              <h2 style="margin: 0;">🏴 Flag Change Notification</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px;">
              <table width="100%" cellpadding="12" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="color: #6b7280; width: 120px;">Project</td>
                  <td style="font-weight: 600;">{{projectName}}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="color: #6b7280;">Flag</td>
                  <td style="font-family: monospace; font-weight: 600;">{{flagKey}}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="color: #6b7280;">Environment</td>
                  <td style="font-weight: 600;">{{environment}}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="color: #6b7280;">Action</td>
                  <td style="font-weight: 600;">{{action}}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="color: #6b7280;">Changed by</td>
                  <td>{{changedBy}}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280;">Time</td>
                  <td>{{timestamp}}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private getFlagChangeTextTemplate(): string {
    return `
Flag Change Notification

Project: {{projectName}}
Flag: {{flagKey}}
Environment: {{environment}}
Action: {{action}}
Changed by: {{changedBy}}
Time: {{timestamp}}

---
LaunchLayer - Feature Flags Platform
    `.trim();
  }
}
