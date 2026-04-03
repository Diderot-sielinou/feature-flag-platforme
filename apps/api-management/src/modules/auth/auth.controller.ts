import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Logger,
  HttpStatus,
  HttpCode,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Public } from '../../common/decorators/public.decorator';

import { AuthService, LocalAuthResponse } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly isClerkConfigured: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    this.isClerkConfigured = !!configService.get<string>('clerk.secretKey');
  }

  /**
   * Local dev sign-in. Only available when Clerk is NOT configured.
   */
  @Public()
  @Post('sign-dev')
  @HttpCode(HttpStatus.OK)
  async signInLocalDev(
    @Body() body: { email: string; name: string },
  ): Promise<LocalAuthResponse> {
    if (this.isClerkConfigured) {
      this.logger.error('Attempt to use local-auth endpoint while Clerk is configured.');
      throw new UnauthorizedException('Local authentication is disabled in this environment.');
    }

    return await this.authService.createLocalUserWithToken(body.email, body.name);
  }

  /**
   * Clerk Webhook endpoint.
   * Receives user.created, user.updated, user.deleted events from Clerk.
   *
   * In production, you should verify the webhook signature using
   * the svix library and CLERK_WEBHOOK_SECRET.
   */
  @Public()
  @Post('webhooks/clerk')
  @HttpCode(HttpStatus.OK)
  async handleClerkWebhook(
    @Body() body: { type: string; data: Record<string, unknown> },
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    // Basic validation
    if (!body?.type || !body?.data) {
      throw new BadRequestException('Invalid webhook payload');
    }

    // In production, verify webhook signature with svix
    const webhookSecret = this.configService.get<string>('clerk.webhookSecret');
    if (webhookSecret && (!svixId || !svixTimestamp || !svixSignature)) {
      this.logger.warn('Clerk webhook: missing svix headers');
      throw new UnauthorizedException('Missing webhook signature headers');
    }

    // TODO: Add svix signature verification for production
    // const wh = new Webhook(webhookSecret);
    // wh.verify(rawBody, { 'svix-id': svixId, 'svix-timestamp': svixTimestamp, 'svix-signature': svixSignature });

    this.logger.log(`Clerk webhook received: ${body.type}`);

    try {
      await this.authService.handleClerkUserEvent(
        body.type,
        body.data as {
          id: string;
          email_addresses: Array<{ email_address: string; id: string }>;
          first_name?: string;
          last_name?: string;
        },
      );
    } catch (error) {
      this.logger.error(`Clerk webhook processing failed: ${body.type}`, error);
      // Return 200 to prevent Clerk from retrying (we log the error)
    }

    return { received: true };
  }
}
