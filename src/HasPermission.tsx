import React, { ReactNode } from 'react';
import { Role, useAuth } from './auth';

export interface HasPermissionProps {
  /** Permission code required, e.g. 'audit:write', 'users:manage', 'dataset:upload' */
  permission?: string;
  /** List of permissions; checked according to requireAll */
  permissions?: string[];
  /** Role requirement, e.g. 'MINISTRY', 'STATE_NODAL_AUTHORITY', etc. */
  role?: Role;
  /** List of allowed roles */
  roles?: Role[];
  /** If multiple permissions/roles, require all (true) or any (false, default) */
  requireAll?: boolean;
  /** UI to display if permission is NOT granted */
  fallback?: ReactNode;
  /** Function as child or render prop pattern */
  render?: (permitted: boolean) => ReactNode;
  /** Children to render when permitted */
  children?: ReactNode;
}

/**
 * Wrapper component that conditionally displays specific UI elements,
 * like audit action buttons, administrative tables, or sensitive operational tools,
 * based on the user's role permissions returned from the AuthProvider.
 */
export function HasPermission({
  permission,
  permissions,
  role,
  roles,
  requireAll = false,
  fallback = null,
  render,
  children,
}: HasPermissionProps) {
  const { user, can } = useAuth();

  const isPermitted = React.useMemo(() => {
    if (!user) return false;

    // Check roles if specified
    const targetRoles = roles || (role ? [role] : []);
    let roleOk = true;
    if (targetRoles.length > 0) {
      roleOk = targetRoles.includes(user.role);
    }

    // Check permissions if specified
    const targetPerms = permissions || (permission ? [permission] : []);
    let permOk = true;
    if (targetPerms.length > 0) {
      permOk = requireAll
        ? targetPerms.every(p => can(p))
        : targetPerms.some(p => can(p));
    }

    return roleOk && permOk;
  }, [user, can, permission, permissions, role, roles, requireAll]);

  if (render) {
    return <>{render(isPermitted)}</>;
  }

  if (isPermitted) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}

/**
 * Convenience aliases for specialized gating scenarios
 */
export const PermissionGate = HasPermission;
export const RoleGate = HasPermission;

export default HasPermission;
