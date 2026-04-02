import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { Strategy, ExtractJwt } from 'passport-jwt';

import { AuthService, AuthenticatedUser } from '../auth.service';

interface CognitoJwtPayload {
  sub: string;
  iss: string;
  client_id: string;
  origin_jti: string;
  event_id: string;
  token_use: 'access' | 'id';
  scope: string;
  auth_time: number;
  exp: number;
  iat: number;
  jti: string;
  username: string;
  email?: string;
  'cognito:username'?: string;
}

@Injectable()
export class CognitoStrategy extends PassportStrategy(Strategy, 'cognito') {
  private readonly logger = new Logger(CognitoStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const userPoolId = configService.get<string>('cognito.userPoolId');
    const region = configService.get<string>('cognito.region') || 'us-east-1';
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    const jwksUri = `${issuer}/.well-known/jwks.json`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience: configService.get<string>('cognito.clientId'),
      issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri,
      }),
    });
  }

  async validate(payload: CognitoJwtPayload): Promise<AuthenticatedUser> {
    this.logger.debug(`Validating Cognito token for user: ${payload.username}`);

    // Verify token_use is 'access' or 'id'
    if (!['access', 'id'].includes(payload.token_use)) {
      throw new UnauthorizedException('Invalid token type');
    }

    // Get the Cognito username
    const cognitoId = payload.username || payload['cognito:username'];
    if (!cognitoId) {
      throw new UnauthorizedException('Missing username in token');
    }

    // Get email from token or fetch from Cognito
    let email = payload.email;
    if (!email) {
      const cognitoUser = await this.authService.getCognitoUser(cognitoId);
      email = cognitoUser?.email;
    }

    if (!email) {
      throw new UnauthorizedException('Unable to determine user email');
    }

    // Get or create user in our database
    const user = await this.authService.getOrCreateUser(cognitoId, email);

    return user;
  }
}
