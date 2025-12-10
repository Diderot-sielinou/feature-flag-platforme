// src/modules/email/email.service.ts
// Service d'envoi d'emails via AWS SES
// Aligné avec les variables d'environnement du compute-stack.ts CDK

import {
  SESClient,
  SendEmailCommand,
  SendTemplatedEmailCommand,
} from '@aws-sdk/client-ses';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectRole } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface InvitationEmailData {
  projectName: string;
  inviterName: string;
  inviterEmail: string;
  role: ProjectRole;
  token: string;
  recipientEmail: string;
  isNewUser: boolean;
  temporaryPassword?: string;
}

export interface WelcomeEmailData {
  userName: string;
  recipientEmail: string;
}

export interface FlagChangeEmailData {
  projectName: string;
  flagKey: string;
  environment: string;
  action: 'enabled' | 'disabled' | 'updated' | 'deleted';
  changedBy: string;
  timestamp: string;
  recipientEmails: string[];
}

export interface GenericEmailData {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}

// =============================================================================
// EmailService
// =============================================================================

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private sesClient: SESClient | null = null;

  // Configuration (lue depuis les variables d'environnement ECS)
  private readonly isProduction: boolean;
  private readonly isEnabled: boolean;
  private readonly region: string;
  private readonly senderEmail: string;
  private readonly senderName: string;
  private readonly configurationSet: string;
  private readonly replyToEmail: string | undefined;
  private readonly dashboardUrl: string;
  private readonly docsUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Lecture des variables d'environnement via ConfigService
    // Ces variables correspondent à celles définies dans compute-stack.ts :
    // - NODE_ENV
    // - AWS_REGION
    // - SES_SENDER_EMAIL
    // - SES_CONFIGURATION_SET
    // - DASHBOARD_URL (à ajouter dans compute-stack si besoin)

    this.isProduction =
      this.configService.get<string>('nodeEnv') === 'production';
    this.isEnabled =
      this.configService.get<boolean>('email.enabled') ?? this.isProduction;
    this.region = this.configService.get<string>('aws.region') || 'us-east-1';
    this.senderEmail = this.configService.get<string>('email.senderEmail')!;
    this.senderName =
      this.configService.get<string>('email.senderName') || 'LaunchLayer';
    this.configurationSet = this.configService.get<string>(
      'email.configurationSet',
    )!;
    this.replyToEmail = this.configService.get<string>('email.replyToEmail');
    this.dashboardUrl = this.configService.get<string>('app.dashboardUrl')!;
    this.docsUrl = this.configService.get<string>('app.docsUrl')!;
  }

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled) {
      this.logger.warn(
        '📧 Email service is DISABLED (dev mode or EMAIL_ENABLED=false)',
      );
      return;
    }

    try {
      // Initialisation du client SES avec la région AWS
      this.sesClient = new SESClient({ region: this.region });

      this.logger.log(
        `📧 Email service initialized (region: ${this.region}, sender: ${this.senderEmail})`,
      );

      if (!this.isProduction) {
        this.logger.warn(
          '📧 DEV MODE: Emails may fail if SES is in sandbox mode (only verified addresses)',
        );
      }
    } catch (error) {
      this.logger.error('❌ Failed to initialize SES client', error);
      // Ne pas throw pour permettre au service de démarrer sans emails en dev
    }
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Envoie un email d'invitation au projet
   * Gère les nouveaux utilisateurs (avec credentials) et les utilisateurs existants
   */
  async sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
    const invitationUrl = this.buildInvitationUrl(data.token);

    // En mode dev sans email activé, on log seulement
    if (!this.isEnabled || !this.sesClient) {
      this.logEmailDryRun('INVITATION', data.recipientEmail, {
        projectName: data.projectName,
        isNewUser: data.isNewUser,
        invitationUrl,
        hasTemporaryPassword: !!data.temporaryPassword,
      });
      return true;
    }

    try {
      // Choix du template selon le type d'utilisateur
      const htmlBody = data.isNewUser
        ? this.buildNewUserInvitationHtml({ ...data, invitationUrl })
        : this.buildExistingUserInvitationHtml({ ...data, invitationUrl });

      const textBody = data.isNewUser
        ? this.buildNewUserInvitationText({ ...data, invitationUrl })
        : this.buildExistingUserInvitationText({ ...data, invitationUrl });

      await this.sendRawEmail({
        to: data.recipientEmail,
        subject: `You've been invited to ${data.projectName} on LaunchLayer`,
        htmlBody,
        textBody,
        replyTo: data.inviterEmail,
      });

      this.logger.log(
        `✅ Invitation email sent to ${data.recipientEmail} (newUser: ${data.isNewUser})`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send invitation email to ${data.recipientEmail}`,
        error,
      );
      return false;
    }
  }

  /**
   * Envoie un email de bienvenue aux nouveaux utilisateurs auto-inscrits
   */
  async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    if (!this.isEnabled || !this.sesClient) {
      this.logEmailDryRun('WELCOME', data.recipientEmail, {
        userName: data.userName,
      });
      return true;
    }

    try {
      // Utilisation du template SES (pas de conditionnels nécessaires)
      const command = new SendTemplatedEmailCommand({
        Source: this.formatSender(),
        Destination: { ToAddresses: [data.recipientEmail] },
        Template: 'feature-flags-welcome',
        TemplateData: JSON.stringify({
          userName: data.userName || data.recipientEmail.split('@')[0],
          dashboardUrl: this.dashboardUrl,
          docsUrl: this.docsUrl,
        }),
        ConfigurationSetName: this.configurationSet,
      });

      await this.sesClient.send(command);
      this.logger.log(`✅ Welcome email sent to ${data.recipientEmail}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send welcome email to ${data.recipientEmail}`,
        error,
      );
      return false;
    }
  }

  /**
   * Envoie une notification de changement de flag aux membres du projet
   */
  async sendFlagChangeNotification(
    data: FlagChangeEmailData,
  ): Promise<boolean> {
    if (
      !this.isEnabled ||
      !this.sesClient ||
      data.recipientEmails.length === 0
    ) {
      this.logEmailDryRun('FLAG_CHANGE', data.recipientEmails.join(', '), {
        flagKey: data.flagKey,
        action: data.action,
      });
      return true;
    }

    try {
      // Utilisation du template SES pour les notifications de flags
      const results = await Promise.allSettled(
        data.recipientEmails.map((email) =>
          this.sesClient!.send(
            new SendTemplatedEmailCommand({
              Source: this.formatSender(),
              Destination: { ToAddresses: [email] },
              Template: 'feature-flags-flag-change',
              TemplateData: JSON.stringify({
                projectName: data.projectName,
                flagKey: data.flagKey,
                environment: data.environment,
                action: this.formatAction(data.action),
                changedBy: data.changedBy,
                timestamp: data.timestamp,
              }),
              ConfigurationSetName: this.configurationSet,
            }),
          ),
        ),
      );

      const successCount = results.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      this.logger.log(
        `✅ Flag change emails: ${successCount}/${data.recipientEmails.length} sent`,
      );
      return successCount > 0;
    } catch (error) {
      this.logger.error('❌ Failed to send flag change notifications', error);
      return false;
    }
  }

  /**
   * Envoie un email brut (sans template SES)
   */
  async sendRawEmail(data: GenericEmailData): Promise<boolean> {
    if (!this.isEnabled || !this.sesClient) {
      this.logEmailDryRun(
        'RAW',
        Array.isArray(data.to) ? data.to.join(', ') : data.to,
        {
          subject: data.subject,
        },
      );
      return true;
    }

    const toAddresses = Array.isArray(data.to) ? data.to : [data.to];

    const command = new SendEmailCommand({
      Source: this.formatSender(),
      Destination: { ToAddresses: toAddresses },
      ReplyToAddresses: data.replyTo
        ? [data.replyTo]
        : this.replyToEmail
          ? [this.replyToEmail]
          : undefined,
      Message: {
        Subject: { Data: data.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: data.htmlBody, Charset: 'UTF-8' },
          ...(data.textBody && {
            Text: { Data: data.textBody, Charset: 'UTF-8' },
          }),
        },
      },
      ConfigurationSetName: this.configurationSet,
    });

    await this.sesClient.send(command);
    return true;
  }

  // ===========================================================================
  // PRIVATE - URL BUILDERS
  // ===========================================================================

  private buildInvitationUrl(token: string): string {
    return `${this.dashboardUrl}/invitations/accept?token=${encodeURIComponent(token)}`;
  }

  private formatSender(): string {
    return `${this.senderName} <${this.senderEmail}>`;
  }

  private formatRole(role: ProjectRole): string {
    const roleMap: Record<ProjectRole, string> = {
      OWNER: 'Owner',
      ADMIN: 'Administrator',
      EDITOR: 'Editor',
      VIEWER: 'Viewer',
    };
    return roleMap[role] || role;
  }

  private formatAction(action: string): string {
    const actionMap: Record<string, string> = {
      enabled: 'Enabled',
      disabled: 'Disabled',
      updated: 'Updated',
      deleted: 'Deleted',
    };
    return actionMap[action] || action;
  }

  // ===========================================================================
  // PRIVATE - EMAIL TEMPLATES (HTML pour invitations avec conditionnels)
  // Note: SES ne supporte pas les conditionnels Handlebars, donc on génère en code
  // ===========================================================================

  /**
   * Template HTML pour invitation NOUVEAU utilisateur (avec credentials)
   */
  private buildNewUserInvitationHtml(data: {
    projectName: string;
    inviterName: string;
    role: ProjectRole;
    invitationUrl: string;
    recipientEmail: string;
    temporaryPassword?: string;
  }): string {
    const year = new Date().getFullYear();
    const roleDisplay = this.formatRole(data.role);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to ${this.escapeHtml(data.projectName)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🚀 LaunchLayer</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Feature Flags Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px;">Welcome! You've been invited</h2>
              
              <p style="margin: 0 0 16px 0; color: #4b5563;">
                <strong>${this.escapeHtml(data.inviterName)}</strong> has invited you to join 
                <strong>${this.escapeHtml(data.projectName)}</strong> on LaunchLayer.
              </p>
              
              <p style="margin: 0 0 24px 0;">
                Your role: 
                <span style="display: inline-block; background: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 600;">
                  ${roleDisplay}
                </span>
              </p>
              
              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 18px;">🔐 Your Account Credentials</h3>
                    <p style="margin: 0 0 16px 0; color: #78350f; font-size: 14px;">
                      An account has been created for you. Use these credentials to log in:
                    </p>
                    
                    <!-- Email -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; margin-bottom: 8px;">
                      <tr>
                        <td style="padding: 12px 16px;">
                          <span style="color: #6b7280; font-size: 12px; display: block;">Email</span>
                          <span style="color: #1f2937; font-weight: 600; font-family: monospace;">${this.escapeHtml(data.recipientEmail)}</span>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Password -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px;">
                      <tr>
                        <td style="padding: 12px 16px;">
                          <span style="color: #6b7280; font-size: 12px; display: block;">Temporary Password</span>
                          <span style="color: #1f2937; font-weight: 600; font-family: monospace;">${this.escapeHtml(data.temporaryPassword || 'Check your email')}</span>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Warning -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; margin-top: 16px;">
                      <tr>
                        <td style="padding: 12px 16px;">
                          <p style="margin: 0; color: #991b1b; font-size: 13px;">
                            ⚠️ <strong>Important:</strong> You will be asked to change this password on your first login.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Steps -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">🎯 Getting Started</h3>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; vertical-align: top; width: 36px;">
                          <span style="display: inline-block; background: #667eea; color: #ffffff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">1</span>
                        </td>
                        <td style="padding: 8px 0; color: #4b5563;">Click the button below to accept the invitation</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; vertical-align: top;">
                          <span style="display: inline-block; background: #667eea; color: #ffffff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">2</span>
                        </td>
                        <td style="padding: 8px 0; color: #4b5563;">Log in with your email and temporary password</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; vertical-align: top;">
                          <span style="display: inline-block; background: #667eea; color: #ffffff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">3</span>
                        </td>
                        <td style="padding: 8px 0; color: #4b5563;">Set your new secure password when prompted</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; vertical-align: top;">
                          <span style="display: inline-block; background: #667eea; color: #ffffff; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">4</span>
                        </td>
                        <td style="padding: 8px 0; color: #4b5563;">Start managing feature flags! 🎉</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px 0;">
                    <a href="${this.escapeHtml(data.invitationUrl)}" 
                       style="display: inline-block; background: #667eea; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                This invitation will expire in 72 hours.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
              
              <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${year} LaunchLayer. All rights reserved.
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

  /**
   * Template HTML pour invitation utilisateur EXISTANT (sans credentials)
   */
  private buildExistingUserInvitationHtml(data: {
    projectName: string;
    inviterName: string;
    role: ProjectRole;
    invitationUrl: string;
  }): string {
    const year = new Date().getFullYear();
    const roleDisplay = this.formatRole(data.role);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to ${this.escapeHtml(data.projectName)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🚀 LaunchLayer</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Feature Flags Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px;">You've been invited!</h2>
              
              <p style="margin: 0 0 16px 0; color: #4b5563;">
                <strong>${this.escapeHtml(data.inviterName)}</strong> has invited you to join 
                <strong>${this.escapeHtml(data.projectName)}</strong> on LaunchLayer.
              </p>
              
              <p style="margin: 0 0 32px 0;">
                Your role: 
                <span style="display: inline-block; background: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 600;">
                  ${roleDisplay}
                </span>
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px 0;">
                    <a href="${this.escapeHtml(data.invitationUrl)}" 
                       style="display: inline-block; background: #667eea; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                This invitation will expire in 72 hours.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
              
              <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${year} LaunchLayer. All rights reserved.
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

  /**
   * Template TEXT pour invitation NOUVEAU utilisateur
   */
  private buildNewUserInvitationText(data: {
    projectName: string;
    inviterName: string;
    role: ProjectRole;
    invitationUrl: string;
    recipientEmail: string;
    temporaryPassword?: string;
  }): string {
    return `
Welcome to LaunchLayer!

${data.inviterName} has invited you to join "${data.projectName}" with the role: ${this.formatRole(data.role)}.

YOUR ACCOUNT CREDENTIALS
========================
An account has been created for you:

Email: ${data.recipientEmail}
Temporary Password: ${data.temporaryPassword || 'Check your email'}

⚠️ IMPORTANT: You will be asked to change this password on your first login.

GETTING STARTED
===============
1. Click the link below to accept the invitation
2. Log in with your email and temporary password
3. Set your new secure password when prompted
4. Start managing feature flags!

Accept Invitation: ${data.invitationUrl}

This invitation will expire in 72 hours.

---
If you didn't expect this invitation, you can safely ignore this email.

LaunchLayer - Feature Flags Platform
    `.trim();
  }

  /**
   * Template TEXT pour invitation utilisateur EXISTANT
   */
  private buildExistingUserInvitationText(data: {
    projectName: string;
    inviterName: string;
    role: ProjectRole;
    invitationUrl: string;
  }): string {
    return `
You've been invited to LaunchLayer!

${data.inviterName} has invited you to join "${data.projectName}" with the role: ${this.formatRole(data.role)}.

Accept Invitation: ${data.invitationUrl}

This invitation will expire in 72 hours.

---
If you didn't expect this invitation, you can safely ignore this email.

LaunchLayer - Feature Flags Platform
    `.trim();
  }

  // ===========================================================================
  // PRIVATE - UTILITIES
  // ===========================================================================

  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
  }

  private logEmailDryRun(
    type: string,
    to: string,
    data: Record<string, unknown>,
  ): void {
    this.logger.debug(`📧 [DRY RUN] ${type} email to ${to}`, data);
  }
}
