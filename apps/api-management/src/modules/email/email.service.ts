// src/modules/email/email.service.ts
// Service d'envoi d'emails — supporte Resend (VPS) et AWS SES

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
// Transport interface — SES or Resend
// =============================================================================

interface EmailTransport {
  send(params: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
  }): Promise<void>;
}

// =============================================================================
// EmailService
// =============================================================================

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transport: EmailTransport | null = null;

  private readonly isEnabled: boolean;
  private readonly emailProvider: string;
  private readonly senderEmail: string;
  private readonly senderName: string;
  private readonly replyToEmail: string | undefined;
  private readonly dashboardUrl: string;
  private readonly docsUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled =
      this.configService.get<boolean>('email.enabled') ??
      this.configService.get<string>('nodeEnv') === 'production';
    this.emailProvider = this.configService.get<string>('email.provider') || 'resend';
    this.senderEmail = this.configService.get<string>('email.senderEmail')!;
    this.senderName =
      this.configService.get<string>('email.senderName') || 'LaunchLayer';
    this.replyToEmail = this.configService.get<string>('email.replyToEmail');
    this.dashboardUrl = this.configService.get<string>('app.dashboardUrl')!;
    this.docsUrl = this.configService.get<string>('app.docsUrl')!;
  }

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled) {
      this.logger.warn(
        'Email service is DISABLED (dev mode or EMAIL_ENABLED=false)',
      );
      return;
    }

    try {
      if (this.emailProvider === 'ses') {
        this.transport = await this.createSesTransport();
        this.logger.log(`Email service initialized (provider: SES)`);
      } else {
        this.transport = await this.createResendTransport();
        this.logger.log(`Email service initialized (provider: Resend)`);
      }
    } catch (error) {
      this.logger.error('Failed to initialize email transport', error);
    }
  }

  // ===========================================================================
  // TRANSPORT FACTORIES
  // ===========================================================================

  private async createResendTransport(): Promise<EmailTransport> {
    const apiKey = this.configService.get<string>('email.resendApiKey');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set — emails will be dry-run');
      return this.createDryRunTransport();
    }

    // Dynamic import to avoid requiring resend when using SES
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    return {
      async send(params) {
        await resend.emails.send({
          from: params.from,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
          replyTo: params.replyTo,
        });
      },
    };
  }

  private async createSesTransport(): Promise<EmailTransport> {
    const region = this.configService.get<string>('aws.region') || 'us-east-1';
    const configurationSet = this.configService.get<string>('email.configurationSet');

    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
    const sesClient = new SESClient({ region });

    return {
      async send(params) {
        const command = new SendEmailCommand({
          Source: params.from,
          Destination: { ToAddresses: params.to },
          ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
          Message: {
            Subject: { Data: params.subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: params.html, Charset: 'UTF-8' },
              ...(params.text && {
                Text: { Data: params.text, Charset: 'UTF-8' },
              }),
            },
          },
          ConfigurationSetName: configurationSet || undefined,
        });
        await sesClient.send(command);
      },
    };
  }

  private createDryRunTransport(): EmailTransport {
    const logger = this.logger;
    return {
      // eslint-disable-next-line @typescript-eslint/require-await
      async send(params) {
        logger.debug(`[DRY RUN] Email to ${params.to.join(', ')}: ${params.subject}`);
      },
    };
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  async sendInvitationEmail(data: InvitationEmailData): Promise<boolean> {
    const invitationUrl = this.buildInvitationUrl(data.token);

    if (!this.isEnabled || !this.transport) {
      this.logEmailDryRun('INVITATION', data.recipientEmail, {
        projectName: data.projectName,
        isNewUser: data.isNewUser,
        invitationUrl,
      });
      return true;
    }

    try {
      const htmlBody = data.isNewUser
        ? this.buildNewUserInvitationHtml({ ...data, invitationUrl })
        : this.buildExistingUserInvitationHtml({ ...data, invitationUrl });

      const textBody = data.isNewUser
        ? this.buildNewUserInvitationText({ ...data, invitationUrl })
        : this.buildExistingUserInvitationText({ ...data, invitationUrl });

      await this.transport.send({
        from: this.formatSender(),
        to: [data.recipientEmail],
        subject: `You've been invited to ${data.projectName} on LaunchLayer`,
        html: htmlBody,
        text: textBody,
        replyTo: data.inviterEmail,
      });

      this.logger.log(
        `Invitation email sent to ${data.recipientEmail} (newUser: ${data.isNewUser})`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send invitation email to ${data.recipientEmail}`,
        error,
      );
      return false;
    }
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    if (!this.isEnabled || !this.transport) {
      this.logEmailDryRun('WELCOME', data.recipientEmail, {
        userName: data.userName,
      });
      return true;
    }

    try {
      const userName = data.userName || data.recipientEmail.split('@')[0];
      await this.transport.send({
        from: this.formatSender(),
        to: [data.recipientEmail],
        subject: `Welcome to LaunchLayer, ${userName}!`,
        html: this.buildWelcomeHtml(userName),
        text: this.buildWelcomeText(userName),
      });

      this.logger.log(`Welcome email sent to ${data.recipientEmail}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${data.recipientEmail}`,
        error,
      );
      return false;
    }
  }

  async sendFlagChangeNotification(
    data: FlagChangeEmailData,
  ): Promise<boolean> {
    if (
      !this.isEnabled ||
      !this.transport ||
      data.recipientEmails.length === 0
    ) {
      this.logEmailDryRun('FLAG_CHANGE', data.recipientEmails.join(', '), {
        flagKey: data.flagKey,
        action: data.action,
      });
      return true;
    }

    try {
      const results = await Promise.allSettled(
        data.recipientEmails.map((email) =>
          this.transport!.send({
            from: this.formatSender(),
            to: [email],
            subject: `[${data.projectName}] Flag "${data.flagKey}" ${data.action} in ${data.environment}`,
            html: this.buildFlagChangeHtml(data),
            text: this.buildFlagChangeText(data),
          }),
        ),
      );

      const successCount = results.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      this.logger.log(
        `Flag change emails: ${successCount}/${data.recipientEmails.length} sent`,
      );
      return successCount > 0;
    } catch (error) {
      this.logger.error('Failed to send flag change notifications', error);
      return false;
    }
  }

  async sendRawEmail(data: GenericEmailData): Promise<boolean> {
    if (!this.isEnabled || !this.transport) {
      this.logEmailDryRun(
        'RAW',
        Array.isArray(data.to) ? data.to.join(', ') : data.to,
        { subject: data.subject },
      );
      return true;
    }

    const toAddresses = Array.isArray(data.to) ? data.to : [data.to];

    await this.transport.send({
      from: this.formatSender(),
      to: toAddresses,
      subject: data.subject,
      html: data.htmlBody,
      text: data.textBody,
      replyTo: data.replyTo || this.replyToEmail,
    });
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
  // PRIVATE - EMAIL TEMPLATES
  // ===========================================================================

  private buildNewUserInvitationHtml(data: {
    projectName: string;
    inviterName: string;
    role: ProjectRole;
    invitationUrl: string;
    recipientEmail: string;
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
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">LaunchLayer</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Feature Flags Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px;">Welcome! You've been invited</h2>
              <p style="margin: 0 0 16px 0; color: #4b5563;">
                <strong>${this.escapeHtml(data.inviterName)}</strong> has invited you to join
                <strong>${this.escapeHtml(data.projectName)}</strong> on LaunchLayer.
              </p>
              <p style="margin: 0 0 32px 0;">
                Your role:
                <span style="display: inline-block; background: #fff7ed; color: #ea580c; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 600;">
                  ${roleDisplay}
                </span>
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">Getting Started</h3>
                    <p style="margin: 0; color: #4b5563; font-size: 14px;">
                      1. Click the button below to accept the invitation<br>
                      2. Create your account or sign in<br>
                      3. Start managing feature flags!
                    </p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px 0;">
                    <a href="${this.escapeHtml(data.invitationUrl)}"
                       style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
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
          <tr>
            <td style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">&copy; ${year} LaunchLayer. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

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
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">LaunchLayer</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Feature Flags Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px;">You've been invited!</h2>
              <p style="margin: 0 0 16px 0; color: #4b5563;">
                <strong>${this.escapeHtml(data.inviterName)}</strong> has invited you to join
                <strong>${this.escapeHtml(data.projectName)}</strong> on LaunchLayer.
              </p>
              <p style="margin: 0 0 32px 0;">
                Your role:
                <span style="display: inline-block; background: #fff7ed; color: #ea580c; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 600;">
                  ${roleDisplay}
                </span>
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px 0;">
                    <a href="${this.escapeHtml(data.invitationUrl)}"
                       style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
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
          <tr>
            <td style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">&copy; ${year} LaunchLayer. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private buildNewUserInvitationText(data: {
    projectName: string;
    inviterName: string;
    role: ProjectRole;
    invitationUrl: string;
    recipientEmail: string;
  }): string {
    return `
Welcome to LaunchLayer!

${data.inviterName} has invited you to join "${data.projectName}" with the role: ${this.formatRole(data.role)}.

GETTING STARTED
===============
1. Click the link below to accept the invitation
2. Create your account or sign in
3. Start managing feature flags!

Accept Invitation: ${data.invitationUrl}

This invitation will expire in 72 hours.

---
If you didn't expect this invitation, you can safely ignore this email.

LaunchLayer - Feature Flags Platform
    `.trim();
  }

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

  private buildWelcomeHtml(userName: string): string {
    const year = new Date().getFullYear();
    return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden;">
        <tr><td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px;">LaunchLayer</h1>
        </td></tr>
        <tr><td style="padding: 32px;">
          <h2 style="margin: 0 0 16px 0;">Welcome, ${this.escapeHtml(userName)}!</h2>
          <p style="color: #4b5563;">Your account is ready. Start creating feature flags, set up environments, and invite your team.</p>
          <table width="100%"><tr><td align="center" style="padding: 24px 0;">
            <a href="${this.dashboardUrl}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Go to Dashboard
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">&copy; ${year} LaunchLayer</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private buildWelcomeText(userName: string): string {
    return `Welcome to LaunchLayer, ${userName}!\n\nYour account is ready. Go to ${this.dashboardUrl}/dashboard to get started.`;
  }

  private buildFlagChangeHtml(data: FlagChangeEmailData): string {
    return `
<html><body style="font-family: sans-serif; padding: 20px;">
  <h2>[${this.escapeHtml(data.projectName)}] Flag Update</h2>
  <p>Flag <strong>${this.escapeHtml(data.flagKey)}</strong> was <strong>${this.formatAction(data.action)}</strong> in <strong>${this.escapeHtml(data.environment)}</strong>.</p>
  <p>Changed by: ${this.escapeHtml(data.changedBy)}<br>Time: ${data.timestamp}</p>
  <p><a href="${this.dashboardUrl}">View in Dashboard</a></p>
</body></html>`;
  }

  private buildFlagChangeText(data: FlagChangeEmailData): string {
    return `[${data.projectName}] Flag "${data.flagKey}" ${data.action} in ${data.environment} by ${data.changedBy} at ${data.timestamp}`;
  }

  // ===========================================================================
  // UTILITIES
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
    this.logger.debug(`[DRY RUN] ${type} email to ${to}`, data);
  }
}
