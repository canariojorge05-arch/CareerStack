import { UserRoleType, UserRole, Permissions, PermissionType } from '@shared/schema';

/**
 * Role hierarchy levels
 */
const roleHierarchy: Record<UserRoleType, number> = {
  [UserRole.USER]: 1,
  [UserRole.MARKETING]: 2,
  [UserRole.ADMIN]: 3
};

/**
 * Role-based permissions mapping
 */
const rolePermissions: Record<UserRoleType, PermissionType[]> = {
  [UserRole.USER]: [
    Permissions.MANAGE_OWN_RESUMES,
    Permissions.PROCESS_TECH_STACKS,
    Permissions.UPLOAD_DOCUMENTS
  ],
  [UserRole.MARKETING]: [
    Permissions.MANAGE_OWN_RESUMES,
    Permissions.PROCESS_TECH_STACKS,
    Permissions.UPLOAD_DOCUMENTS,
    Permissions.ACCESS_MARKETING,
    Permissions.MANAGE_CONSULTANTS,
    Permissions.MANAGE_REQUIREMENTS,
    Permissions.MANAGE_INTERVIEWS,
    Permissions.SEND_EMAILS
  ],
  [UserRole.ADMIN]: [
    Permissions.MANAGE_OWN_RESUMES,
    Permissions.PROCESS_TECH_STACKS,
    Permissions.UPLOAD_DOCUMENTS,
    Permissions.ACCESS_MARKETING,
    Permissions.MANAGE_CONSULTANTS,
    Permissions.MANAGE_REQUIREMENTS,
    Permissions.MANAGE_INTERVIEWS,
    Permissions.SEND_EMAILS,
    Permissions.MANAGE_USERS,
    Permissions.ASSIGN_ROLES,
    Permissions.VIEW_AUDIT_LOGS,
    Permissions.SYSTEM_CONFIG,
    Permissions.ACCESS_ALL_DATA
  ]
};

/**
 * Check if a role has a specific permission
 */
export const hasPermission = (role: UserRoleType, permission: PermissionType): boolean => {
  return rolePermissions[role]?.includes(permission) || false;
};

/**
 * Check if a role has any of the specified permissions
 */
export const hasAnyPermission = (role: UserRoleType, permissions: PermissionType[]): boolean => {
  return permissions.some(permission => hasPermission(role, permission));
};

/**
 * Check if a role has all of the specified permissions
 */
export const hasAllPermissions = (role: UserRoleType, permissions: PermissionType[]): boolean => {
  return permissions.every(permission => hasPermission(role, permission));
};

/**
 * Check if role meets or exceeds the required role level
 */
export const hasRoleLevel = (userRole: UserRoleType, requiredRole: UserRoleType): boolean => {
  return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
};

/**
 * Get all permissions for a role
 */
export const getRolePermissions = (role: UserRoleType): PermissionType[] => {
  return rolePermissions[role] || [];
};