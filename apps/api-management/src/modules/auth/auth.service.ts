import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../database/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  cognitoId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  cognitoId: string;
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
  private readonly cognitoClient: CognitoIdentityProviderClient;
  private readonly userPoolId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {
    const region = this.configService.get<string>('cognito.region') || 'us-east-1';
    this.userPoolId = this.configService.get<string>('cognito.userPoolId') || '';

    this.cognitoClient = new CognitoIdentityProviderClient({
      region,
    });
  }

  // ==========================================================================
  // JWT TOKEN OPERATIONS
  // ==========================================================================

  /**
   * Validate JWT token and return payload
   */
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

  /**
   * Generate JWT token for a user (for local development)
   */
  generateToken(user: AuthenticatedUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      cognitoId: user.cognitoId,
    };
    return this.jwtService.sign(payload);
  }

  // ==========================================================================
  // USER OPERATIONS
  // ==========================================================================

  /**
   * Get or create user from Cognito ID
   */
  async getOrCreateUser(cognitoId: string, email: string, name?: string): Promise<AuthenticatedUser> {
    // Try to find existing user
    let user = await this.prisma.user.findUnique({
      where: { cognitoId },
    });

    if (!user) {
      // Try to find by email (user might exist from invitation)
      user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // Update with Cognito ID
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { cognitoId, name: name || user.name },
        });
      } else {
        // Create new user
        user = await this.prisma.user.create({
          data: {
            cognitoId,
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
      cognitoId: user.cognitoId,
      email: user.email,
      name: user.name || undefined,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    return {
      id: user.id,
      cognitoId: user.cognitoId,
      email: user.email,
      name: user.name || undefined,
    };
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    return {
      id: user.id,
      cognitoId: user.cognitoId,
      email: user.email,
      name: user.name || undefined,
    };
  }


  /**
   * Create a local user and generate a valid access token.
   * This method is intended for local development/testing when Cognito is not configured.
   */
  async createLocalUserWithToken(email: string, name?: string): Promise<LocalAuthResponse> {
    if (this.userPoolId) {
      // Sécurité: Si Cognito est configuré (mode production/staging),
      // nous ne devons pas permettre l'enregistrement local direct.
      throw new UnauthorizedException(
        'Local user creation is disabled in this environment.',
      );
    }

    // 1. Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      this.logger.debug(`User already exists, generating token for: ${email}`);
    } else {
      // 2. Create new user with a mock cognitoId
      user = await this.prisma.user.create({
        data: {
          // Utiliser un identifiant distinctif pour le développement local
          cognitoId: `local_${email}_${Date.now()}`,
          email,
          name: name,
        },
      });
      this.logger.log(`Created new local user: ${email}`);
    }
    
    // 3. Update last login (important pour le cycle de vie)
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });


    // 4. Generate access token
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      cognitoId: user.cognitoId,
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
  // COGNITO OPERATIONS
  // ==========================================================================

  /**
   * Create a user in Cognito (for invitations)
   */
  async createCognitoUser(
    email: string,
    temporaryPassword?: string,
  ): Promise<{ cognitoId: string; temporaryPassword: string }> {
    if (!this.userPoolId) {
      // In development mode without Cognito, return a mock response
      this.logger.warn('Cognito not configured, returning mock user');
      return {
        cognitoId: `mock_${Date.now()}`,
        temporaryPassword: temporaryPassword || 'TempPass123!',
      };
    }

    try {
      const command = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ],
        TemporaryPassword: temporaryPassword,
        MessageAction: MessageActionType.SUPPRESS, // We'll send our own email
      });

      const response = await this.cognitoClient.send(command);
      const cognitoId = response.User?.Username || '';

      this.logger.log(`Created Cognito user: ${email}`);

      return {
        cognitoId,
        temporaryPassword: temporaryPassword || '',
      };
    } catch (error) {
      this.logger.error(`Failed to create Cognito user: ${email}`, error);
      throw error;
    }
  }

  /**
   * Get user from Cognito by username
   */
  //TODO: no how this fonction works
  async getCognitoUser(username: string): Promise<{ email: string; status: string } | null> {
    if (!this.userPoolId) {
      return null;
    }

    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });

      const response = await this.cognitoClient.send(command);
      const email = response.UserAttributes?.find(
        (attr) => attr.Name === 'email',
      )?.Value;

      return {
        email: email || '',
        status: response.UserStatus || 'UNKNOWN',
      };
    } catch (error) {
      this.logger.error(`Failed to get Cognito user: ${username}`, error);
      return null;
    }
  }

  /**
   * Disable a Cognito user
   */
  async disableCognitoUser(username: string): Promise<boolean> {
    if (!this.userPoolId) {
      return true;
    }

    try {
      const command = new AdminDisableUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });

      await this.cognitoClient.send(command);
      this.logger.log(`Disabled Cognito user: ${username}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to disable Cognito user: ${username}`, error);
      return false;
    }
  }

  /**
   * Enable a Cognito user
   */
  async enableCognitoUser(username: string): Promise<boolean> {
    if (!this.userPoolId) {
      return true;
    }

    try {
      const command = new AdminEnableUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });

      await this.cognitoClient.send(command);
      this.logger.log(`Enabled Cognito user: ${username}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to enable Cognito user: ${username}`, error);
      return false;
    }
  }

  /**
   * Delete a Cognito user
   */
  async deleteCognitoUser(username: string): Promise<boolean> {
    if (!this.userPoolId) {
      return true;
    }

    try {
      const command = new AdminDeleteUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });

      await this.cognitoClient.send(command);
      this.logger.log(`Deleted Cognito user: ${username}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete Cognito user: ${username}`, error);
      return false;
    }
  }
}
