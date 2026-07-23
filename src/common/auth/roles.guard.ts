import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { AuthUser } from './current-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    const roles = user?.roles ?? [];
    const ok = required.some((r) => roles.includes(r));
    if (!ok) {
      throw new ForbiddenException(
        `Requires one of roles [${required.join(', ')}]; you have [${roles.join(', ') || 'none'}]`,
      );
    }
    return true;
  }
}
