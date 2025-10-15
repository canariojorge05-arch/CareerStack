import { UserRoleType, PermissionType } from '@shared/schema';
import { hasPermission, hasRoleLevel } from '@/utils/permissions';

interface User {
  id: string;
  email: string;
  role: UserRoleType;
}

/**
 * Custom hook to check user permissions
 */
export const usePermissions = (user: User | null) => {
  const checkPermission = (permission: PermissionType): boolean => {
    if (!user) return false;
    return hasPermission(user.role, permission);
  };

  const checkRole = (requiredRole: UserRoleType): boolean => {
    if (!user) return false;
    return hasRoleLevel(user.role, requiredRole);
  };

  return {
    checkPermission,
    checkRole,
  };
};

/**
 * Higher-order component for role-based access control
 */
export function withRoleAccess<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredRole: UserRoleType
) {
  return function WithRoleAccessWrapper(props: P & { user: User | null }) {
    const { user, ...rest } = props;

    if (!user || !hasRoleLevel(user.role, requiredRole)) {
      return null; // Or return an unauthorized component
    }

    return <WrappedComponent {...(rest as P)} />;
  };
}

/**
 * Component for conditional rendering based on permissions
 */
interface PermissionGuardProps {
  permission: PermissionType;
  user: User | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  user,
  children,
  fallback = null,
}) => {
  if (!user || !hasPermission(user.role, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * Hook for role-based navigation guards
 */
export const useRoleGuard = (user: User | null, requiredRole: UserRoleType) => {
  if (!user) {
    return {
      isAllowed: false,
      reason: 'Authentication required',
    };
  }

  const isAllowed = hasRoleLevel(user.role, requiredRole);
  return {
    isAllowed,
    reason: isAllowed ? null : 'Insufficient permissions',
  };
};
