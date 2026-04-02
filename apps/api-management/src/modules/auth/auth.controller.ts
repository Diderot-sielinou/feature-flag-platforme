import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { Controller, Post, Body, UnauthorizedException, Logger, HttpStatus, HttpCode } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Public } from '../../common/decorators/public.decorator';

import { AuthService, LocalAuthResponse } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly cognitoClient: CognitoIdentityProviderClient;
  private readonly clientId: string;
  private readonly logger = new Logger(AuthController.name);
  private readonly isCognitoConfigured: boolean;

  constructor(
    private configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    this.clientId = configService.get('cognito.clientId')!;
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: configService.get('cognito.region'),
    });

    const userPoolId = this.configService.get<string>('cognito.userPoolId');
    this.isCognitoConfigured = !!userPoolId;
  }

  @Post('refresh')
  @Public()
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      const response = await this.cognitoClient.send(command);

      return {
        accessToken: response.AuthenticationResult?.AccessToken,
        idToken: response.AuthenticationResult?.IdToken,
        expiresIn: response.AuthenticationResult?.ExpiresIn,
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Endpoint for creating a user and obtaining a token, bypassing Cognito.
   * ONLY AVAILABLE WHEN COGNITO_USER_POOL_ID IS NOT SET.
   */
  @Public()
  @Post('sign-dev')
  @HttpCode(HttpStatus.OK)
  async signInLocalDev(
    @Body() body: {email:string, name: string},
  ): Promise<LocalAuthResponse> {
    if (this.isCognitoConfigured) {
      this.logger.error('Attempt to use local-auth endpoint while Cognito is configured.');
      // Simuler l'absence de la route en production pour des raisons de sécurité
      throw new UnauthorizedException('Local authentication is disabled in this environment.');
    }

    // Utilisation de la nouvelle logique du service
    return await this.authService.createLocalUserWithToken(body.email, body.name);
  }
}
