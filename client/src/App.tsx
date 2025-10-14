import { Switch, Route, useLocation } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { lazy, Suspense, memo, useEffect, useState } from 'react';
import { PageLoader } from '@/components/ui/page-loader';
import { PrivateRoute } from '@/components/auth/private-route';
import { AdminRoute, MarketingRoute } from '@/components/auth/role-based-route';
import { resetAllAuthState } from '@/lib/resetAuthState';

// Lazy load all pages for optimal bundle splitting
const NotFound = lazy(() => import('@/pages/not-found'));
const Landing = lazy(() => import('@/pages/landing'));
const Dashboard = lazy(() => import('@/pages/dashboard'));
const MultiResumeEditorPage = lazy(() => import('@/pages/multi-resume-editor-page'));
const MarketingPage = lazy(() => import('@/pages/marketing'));
const EmailPage = lazy(() => import('@/pages/email'));
const AdminPage = lazy(() => import('@/pages/admin'));
const AdminApprovalsPage = lazy(() => import('@/pages/admin-approvals'));
const AdminSecurityPage = lazy(() => import('@/pages/admin-security'));
const UnauthorizedPage = lazy(() => import('@/pages/unauthorized'));
const VerifyEmail = lazy(() => import('@/pages/verify-email'));
const ResetPassword = lazy(() => import('@/pages/reset-password'));
const Privacy = lazy(() => import('@/pages/privacy'));

const Router = memo(() => {
  const { isAuthenticated, isLoading } = useAuth();

  // Reset auth state only if there are detected loops, not on every mount
  useEffect(() => {
    // Only reset if we detect auth loops AND it's been at least 5 seconds since last check
    const hasAuthLoop = localStorage.getItem('authLoopDetected');
    const lastLoopReset = localStorage.getItem('lastAuthLoopReset');
    const now = Date.now();
    
    if (hasAuthLoop === 'true') {
      // Prevent rapid resets that cause reload loops - increased to 5 seconds
      if (!lastLoopReset || (now - parseInt(lastLoopReset)) > 5000) {
        console.log('Resetting auth state due to detected loop');
        localStorage.setItem('lastAuthLoopReset', now.toString());
        localStorage.removeItem('authLoopDetected');
        resetAllAuthState();
      } else {
        // Just remove the flag if we reset too recently
        localStorage.removeItem('authLoopDetected');
      }
    }
  }, []);

  // Preload likely next pages based on auth status
  useEffect(() => {
    if (!isLoading) {
      const preloadTimer = setTimeout(() => {
        if (isAuthenticated) {
          // Preload dashboard and marketing for authenticated users
          import('@/pages/dashboard');
          import('@/pages/marketing');
          import('@/pages/email');
        } else {
          // Preload landing for non-authenticated users
          import('@/pages/landing');
        }
      }, 100);
      return () => clearTimeout(preloadTimer);
    }
  }, [isAuthenticated, isLoading]);

  // Simplified loading state management
  if (isLoading) {
    return <PageLoader variant="branded" text="Loading..." />;
  }

  return (
    <Suspense fallback={<PageLoader variant="branded" text="Loading application..." />}>
      <Switch>
        {/* Root route - redirect based on auth status */}
        <Route path="/" component={Landing} />
        
        {/* Public Routes */}
        <Route path="/login" component={Landing} />
        <Route path="/register" component={Landing} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/privacy" component={Privacy} />

        {/* Protected Routes */}
        <PrivateRoute path="/dashboard" component={Dashboard} />
        <PrivateRoute path="/editor" component={MultiResumeEditorPage} />
        
        {/* Marketing Routes - Require marketing or admin role */}
        <Route path="/marketing">
          {() => (
            <MarketingRoute>
              <MarketingPage />
            </MarketingRoute>
          )}
        </Route>
        
        <Route path="/email">
          {() => (
            <MarketingRoute>
              <EmailPage />
            </MarketingRoute>
          )}
        </Route>

        {/* Admin Routes - Require admin role */}
        <Route path="/admin">
          {() => (
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          )}
        </Route>

        <Route path="/admin/approvals">
          {() => (
            <AdminRoute>
              <AdminApprovalsPage />
            </AdminRoute>
          )}
        </Route>

        <Route path="/admin/security">
          {() => (
            <AdminRoute>
              <AdminSecurityPage />
            </AdminRoute>
          )}
        </Route>

        {/* Unauthorized page */}
        <Route path="/unauthorized" component={UnauthorizedPage} />

        {/* Catch-all route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
});
Router.displayName = 'Router';

import CookieConsent from '@/components/cookie-consent';
import { ErrorBoundary } from '@/components/error-boundary';

const App = memo(() => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <SonnerToaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
            toastOptions={{
              className: 'toast-custom',
              style: {
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
          <Router />
          <CookieConsent />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
});
App.displayName = 'App';

export default App;
