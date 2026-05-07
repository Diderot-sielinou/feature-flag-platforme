import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { Strategy, ExtractJwt } from 'passport-jwt';

import { AuthService, AuthenticatedUser } from '../auth.service';

interface ClerkJwtPayload {
  sub: string; // Clerk user ID (user_xxx)
  iss: string;
  aud?: string;
  azp?: string; // Authorized party (your frontend URL)
  exp: number;
  iat: number;
  nbf?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  // Clerk session claims
  sid?: string;
}

@Injectable()
export class ClerkStrategy extends PassportStrategy(Strategy, 'clerk') {
  private readonly logger = new Logger(ClerkStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const clerkIssuer = configService.get<string>('clerk.issuer');

    if (!clerkIssuer) {
      // Clerk not configured — strategy won't be used, but Passport requires valid config
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: 'clerk-not-configured',
      });
      return;
    }

    const jwksUri = `${clerkIssuer}/.well-known/jwks.json`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer: clerkIssuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
      }),
    });
  }

  async validate(payload: ClerkJwtPayload): Promise<AuthenticatedUser> {
    this.logger.debug(`Validating Clerk token for user: ${payload.sub}`);

    const clerkUserId = payload.sub;
    if (!clerkUserId) {
      throw new UnauthorizedException('Missing user ID in token');
    }

    // Email may be in session claims or we fetch from DB
    const email = payload.email;
    const name = payload.full_name ||
      [payload.first_name, payload.last_name].filter(Boolean).join(' ') ||
      undefined;

    if (email) {
      return await this.authService.getOrCreateUser(clerkUserId, email, name);
    }

    // If email not in token, look up user by externalId
    const user = await this.authService.getUserByExternalId(clerkUserId);
    if (!user) {
      // User not yet synced — this can happen if webhook hasn't fired yet
      throw new UnauthorizedException(
        'User not found. Please ensure your account is properly set up.',
      );
    }

    return user;
  }
}
