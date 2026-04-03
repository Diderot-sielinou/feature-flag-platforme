import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard(['clerk', 'jwt']) {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: Error | null,
    user: TUser | false,
    info: Error | null,
  ): TUser {
    if (err) {
      this.logger.error('Authentication error:', err.message);
      throw err;
    }

    if (!user) {
      const message = info?.message || 'Authentication required';
      this.logger.warn(`Authentication failed: ${message}`);
      throw new UnauthorizedException(message);
    }

    return user;
  }
}
