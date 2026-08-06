import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { type AuthenticatedUser } from '../../modules/auth/auth.service';

/**
 * Decorator to extract the current authenticated user from the request
 * 
 * Usage:
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 * 
 * // Or extract a specific property
 * @Get('my-id')
 * getMyId(@CurrentUser('id') userId: string) {
 *   return userId;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
