import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Restrict a route to the given roles. Presence of any one role passes. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
