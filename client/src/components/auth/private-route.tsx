import React from 'react';
import { Route } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { NavigationHelper } from '@/lib/navigationHelper';

interface PrivateRouteProps {
  path: string;
  component: React.ComponentType<any>;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ path, component: Component }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [hasRedirected, setHasRedirected] = React.useState(false);
  
  // Redirect logic that respects navigation and doesn't interfere with back button
  React.useEffect(() => {
    // Only redirect if we're sure the user is not authenticated
    // Add a small delay to allow auth state to stabilize after navigation
    const redirectTimer = setTimeout(() => {
      if (!isLoading && !isAuthenticated && !hasRedirected) {
        // Don't redirect during navigation (back button, etc.)
        if (NavigationHelper.shouldPreventAuthRedirect()) {
          return;
        }
        
        const currentPath = window.location.pathname;
        
        // More conservative throttling - don't redirect if we just did
        const lastRedirect = localStorage.getItem('lastPrivateRedirect');
        const now = Date.now();
        
        // Throttle redirects to prevent loops (3 second cooldown)
        if (!lastRedirect || (now - parseInt(lastRedirect)) > 3000) {
          localStorage.setItem('lastPrivateRedirect', now.toString());
          localStorage.setItem('redirectAfterLogin', currentPath);
          setHasRedirected(true);
          setLocation('/login');
        }
      }
    }, 100); // Faster redirect for better UX
    
    return () => clearTimeout(redirectTimer);
  }, [isAuthenticated, isLoading, hasRedirected, setLocation]);

  return (
    <Route
      path={path}
      component={(props) => {
        // Fast path: if we know user is authenticated, render immediately
        if (isAuthenticated) {
          return <Component {...props} />;
        }
        
        // Show minimal loader while checking auth or redirecting
        if (isLoading || !isAuthenticated) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          );
        }

        return <Component {...props} />;
      }}
    />
  );
};
