import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../database/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  externalId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  externalId: string;
  email: string;
  name?: string;
}

export interface LocalAuthResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // ==========================================================================
  // JWT TOKEN OPERATIONS
  // ==========================================================================

  // eslint-disable-next-line @typescript-eslint/require-await
  async validateToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      return payload;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  generateToken(user: AuthenticatedUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      externalId: user.externalId,
    };
    return this.jwtService.sign(payload);
  }

  // ==========================================================================
  // USER OPERATIONS
  // ==========================================================================

  /**
   * Get or create user from external auth provider (Clerk or Cognito).
   * Called by the Clerk/Cognito strategy after JWT validation.
   */
  async getOrCreateUser(externalId: string, email: string, name?: string): Promise<AuthenticatedUser> {
    // Try to find by externalId
    let user = await this.prisma.user.findUnique({
      where: { externalId },
    });

    if (!user) {
      // Try to find by email (user might exist from invitation)
      user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // Update with external ID
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { externalId, name: name || user.name },
        });
      } else {
        // Create new user
        user = await this.prisma.user.create({
          data: {
            externalId,
            email,
            name,
          },
        });
        this.logger.log(`Created new user: ${email}`);
      }
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      id: user.id,
      externalId: user.externalId,
      email: user.email,
      name: user.name || undefined,
    };
  }

  async getUserById(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    return {
      id: user.id,
      externalId: user.externalId,
      email: user.email,
      name: user.name || undefined,
    };
  }

  async getUserByEmail(email: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    return {
      id: user.id,
      externalId: user.externalId,
      email: user.email,
      name: user.name || undefined,
    };
  }

  /**
   * Create a local user and generate a valid access token.
   * Only available when CLERK_SECRET_KEY is not set (local dev).
   */
  async createLocalUserWithToken(email: string, name?: string): Promise<LocalAuthResponse> {
    const clerkKey = this.configService.get<string>('clerk.secretKey');
    if (clerkKey) {
      throw new UnauthorizedException(
        'Local user creation is disabled in this environment.',
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      this.logger.debug(`User already exists, generating token for: ${email}`);
    } else {
      user = await this.prisma.user.create({
        data: {
          externalId: `local_${email}_${Date.now()}`,
          email,
          name,
        },
      });
      this.logger.log(`Created new local user: ${email}`);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      externalId: user.externalId,
      email: user.email,
      name: user.name || undefined,
    };
    const accessToken = this.generateToken(authenticatedUser);

    return {
      accessToken,
      user: authenticatedUser,
    };
  }

  // ==========================================================================
  // CLERK WEBHOOK — User sync
  // ==========================================================================

  /**
   * Handle Clerk webhook: user.created / user.updated
   * Creates or updates the user in our DB when Clerk fires events.
   */
  async handleClerkUserEvent(
    eventType: string,
    data: {
      id: string;
      email_addresses: Array<{ email_address: string; id: string }>;
      first_name?: string;
      last_name?: string;
    },
  ): Promise<void> {
    const primaryEmail = data.email_addresses?.[0]?.email_address;
    if (!primaryEmail) {
      this.logger.warn(`Clerk webhook: no email found for user ${data.id}`);
      return;
    }

    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || undefined;

    if (eventType === 'user.created' || eventType === 'user.updated') {
      await this.getOrCreateUser(data.id, primaryEmail, name);
      this.logger.log(`Clerk webhook: synced user ${primaryEmail} (${eventType})`);
    } else if (eventType === 'user.deleted') {
      const user = await this.prisma.user.findUnique({
        where: { externalId: data.id },
      });
      if (user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { status: 'SUSPENDED', deletedAt: new Date() },
        });
        this.logger.log(`Clerk webhook: suspended user ${primaryEmail}`);
      }
    }
  }

  /**
   * Create a user in the database for invitation purposes.
   * No external auth provider call — the user will set up their own
   * Clerk account when they accept the invitation.
   */
  async createInvitedUser(
    email: string,
  ): Promise<{ externalId: string }> {
    const externalId = `invited_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    await this.prisma.user.create({
      data: {
        externalId,
        email,
        status: 'PENDING_VERIFICATION',
        emailVerified: false,
      },
    });

    this.logger.log(`Created invited user placeholder: ${email}`);
    return { externalId };
  }
}
