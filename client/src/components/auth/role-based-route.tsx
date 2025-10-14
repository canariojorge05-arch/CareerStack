import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

/**
 * RoleBasedRoute Component
 * Protects routes based on user roles
 * Redirects to appropriate page if user doesn't have required role
 */
export function RoleBasedRoute({ children, allowedRoles }: RoleBasedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    const [, setLocation] = useLocation();
    setLocation(`/login?redirect=${encodeURIComponent(location)}`);
    return null;
  }

  // Check if user has required role
  const userRole = user.role || 'user';
  const hasRequiredRole = allowedRoles.includes(userRole);

  if (!hasRequiredRole) {
    // Redirect to unauthorized page or dashboard
    return <Navigate to="/unauthorized" />;
  }

  // User has required role, render children
  return <>{children}</>;
}

/**
 * AdminRoute Component
 * Shortcut for admin-only routes
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  return <RoleBasedRoute allowedRoles={['admin']}>{children}</RoleBasedRoute>;
}

/**
 * MarketingRoute Component
 * Shortcut for marketing and admin routes
 */
export function MarketingRoute({ children }: { children: React.ReactNode }) {
  return <RoleBasedRoute allowedRoles={['marketing', 'admin']}>{children}</RoleBasedRoute>;
}
