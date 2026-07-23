import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Authenticated principal.
 *
 * This reference implementation trusts an upstream gateway/auth service and
 * reads identity from request headers:
 *   x-user-id      the user's id (defaults to "anonymous")
 *   x-user-roles   comma-separated roles, e.g. "admin,analyst"
 *
 * Swap `AuthGuard` for a real JWT strategy in production without touching the
 * modules that consume `CurrentUser`.
 */
export interface AuthUser {
  id: string;
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);
