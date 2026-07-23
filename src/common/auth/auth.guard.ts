import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthUser } from './current-user';

/**
 * Populates `req.user` from trusted headers. Applied globally.
 * Always allows the request through — authorization is enforced by RolesGuard
 * and per-resource ownership checks in the services.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const id = (req.headers['x-user-id'] as string) || 'anonymous';
    const rolesHeader = (req.headers['x-user-roles'] as string) || '';
    const roles = rolesHeader
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    const user: AuthUser = { id, roles };
    req.user = user;
    return true;
  }
}
