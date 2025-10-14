import { UserRoleType, UserRole, RolePermissions, PermissionType } from '@shared/schema';

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(userRole: UserRoleType, permission: PermissionType): boolean {
  const rolePermissions = RolePermissions[userRole];
  return rolePermissions.includes(permission);
}

/**
 * Check if a user role has any of the specified permissions
 */
export function hasAnyPermission(userRole: UserRoleType, permissions: PermissionType[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

/**
 * Check if a user role has all of the specified permissions
 */
export function hasAllPermissions(userRole: UserRoleType, permissions: PermissionType[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

/**
 * Get all permissions for a given role
 */
export function getRolePermissions(userRole: UserRoleType): PermissionType[] {
  return RolePermissions[userRole] || [];
}

/**
 * Check if role is at least as privileged as required role
 * Order: user < marketing < admin
 */
export function hasRoleLevel(userRole: UserRoleType, requiredRole: UserRoleType): boolean {
  const roleHierarchy: Record<UserRoleType, number> = {
    [UserRole.USER]: 1,
    [UserRole.MARKETING]: 2,
    [UserRole.ADMIN]: 3
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Check if user role is allowed for a given action
 * Accepts either a single role or array of allowed roles
 */
export function isRoleAllowed(userRole: UserRoleType, allowedRoles: UserRoleType | UserRoleType[]): boolean {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return roles.includes(userRole);
}

/**
 * Get display name for role
 */
export function getRoleDisplayName(role: UserRoleType): string {
  const displayNames: Record<UserRoleType, string> = {
    [UserRole.USER]: 'User',
    [UserRole.MARKETING]: 'Marketing',
    [UserRole.ADMIN]: 'Administrator'
  };
  
  return displayNames[role] || role;
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRoleType): string {
  const descriptions: Record<UserRoleType, string> = {
    [UserRole.USER]: 'Standard user with access to resume management features',
    [UserRole.MARKETING]: 'Marketing team member with access to consultants, requirements, and interviews',
    [UserRole.ADMIN]: 'System administrator with full access to all features and user management'
  };
  
  return descriptions[role] || '';
}

/**
 * Validate if a string is a valid role
 */
export function isValidRole(role: string): role is UserRoleType {
  return Object.values(UserRole).includes(role as UserRoleType);
}

/**
 * Get all available roles
 */
export function getAllRoles(): UserRoleType[] {
  return Object.values(UserRole);
}
