import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import { clearAllClientAuthData } from '@/lib/clearAuthData';
import { authCircuitBreaker } from '@/lib/authCircuitBreaker';
import { authGlobalState } from '@/lib/authGlobalState';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role?: string; // 'user' | 'marketing' | 'admin'
  createdAt: string;
  updatedAt: string;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDisabled, setIsDisabled] = React.useState(false);
  
  // Check if we should prevent auth requests (but don't return early)
  const shouldPreventAuth = authCircuitBreaker.isCircuitOpen() || authGlobalState.shouldPreventAuthRequest();

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        // Record that we're making an auth request
        authGlobalState.recordAuthRequest();
        
        const response = await fetch("/api/auth/user", {
          credentials: "include",
          headers: {
            "X-Requested-With": "XMLHttpRequest"
          }
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error("UNAUTHORIZED");
          }
          throw new Error(`HTTP_${response.status}`);
        }

        const data = await response.json();
        authCircuitBreaker.recordSuccess();
        
        // Clear any auth loop flags on successful authentication
        localStorage.removeItem('authLoopDetected');
        localStorage.removeItem('lastAuthLoopReset');
        
        return data as User;
      } catch (error: any) {
        // For network errors, throw a specific error
        if (error.name === 'AbortError' || error.message === 'Failed to fetch') {
          throw new Error("NETWORK_ERROR");
        }
        
        authCircuitBreaker.recordFailure();
        throw error;
      }
    },
    retry: false,
    retryDelay: 0,
    staleTime: 30 * 1000, // 30 seconds - longer to reduce requests during startup
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    refetchOnMount: 'always', // Always check auth on mount but React Query will deduplicate
    enabled: !isDisabled && !shouldPreventAuth, // Disable if any safety check fails
  });

  // Simplified error handling to prevent loops
  React.useEffect(() => {
    if (error && error.message) {
      const path = window.location.pathname;
      const onAuthPages = ['/login', '/register', '/verify-email', '/'].includes(path);
      
      // Only handle auth errors, ignore others to prevent loops
      if (error.message === 'UNAUTHORIZED' && !onAuthPages) {
        // Disable the query immediately to stop further requests
        setIsDisabled(true);
        
        // Simple throttled redirect
        const lastRedirect = localStorage.getItem('lastAuthRedirect');
        const now = Date.now().toString();
        
        if (!lastRedirect || (Date.now() - parseInt(lastRedirect)) > 3000) {
          localStorage.setItem('lastAuthRedirect', now);
          // Clear the query data to prevent stale state
          queryClient.setQueryData(["/api/auth/user"], null);
          window.location.href = '/login';
        }
      }
    }
  }, [error, queryClient, setIsDisabled]);

  // Define clearLocalSession outside of logout to make it reusable
  const clearLocalSession = async () => {
    try {
      queryClient.clear();
      await clearAllClientAuthData({ preservePreferences: true });
    } catch (e) {
      console.error('Error clearing local session:', e);
      // Fallback to previous behavior
      queryClient.clear();
      localStorage.removeItem('lastActiveTime');
      sessionStorage.clear();
      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });
    }
  };

  const logout = async () => {
    try {
      // Show logout message immediately
      toast({
        title: "Logging out...",
        description: "Please wait a moment.",
        duration: 1000,
      });

      // Make server logout call first
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

      // Fire and forget - don't await this
      fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
        }
      }).catch(() => {
        // Ignore server errors during logout
        console.log("Server logout failed, but local session cleared");
      });

      // Clear local session data
      await clearLocalSession();
      
      // Clear query cache
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.clear();
      
      // Use setTimeout to ensure all state updates are processed
      setTimeout(() => {
        window.location.href = "/";
      }, 100);
      
    } catch (error) {
      console.error("Logout error:", error);
      
      // Even on error, clear everything and redirect
      try {
        await clearLocalSession();
        queryClient.setQueryData(["/api/auth/user"], null);
        queryClient.clear();
      } catch (e) {
        console.error("Error during cleanup:", e);
      }
      
      setTimeout(() => {
        window.location.href = "/";
      }, 100);
    }
  };

  const refreshUser = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (error) {
      console.error("Error refreshing user data:", error);
      toast({
        variant: "destructive",
        title: "Refresh Error",
        description: "Failed to refresh user data. Please try again.",
      });
    }
  };

  // Add an interval to check session activity - only when authenticated
  React.useEffect(() => {
    // Only run session timeout logic when user is authenticated
    if (!user) {
      return;
    }

    const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 minutes (match server session)
    const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // 1 minute

    const checkSessionActivity = () => {
      const lastActiveTime = localStorage.getItem("lastActiveTime");
      if (lastActiveTime) {
        const inactiveTime = Date.now() - parseInt(lastActiveTime);
        if (inactiveTime > SESSION_TIMEOUT) {
          logout();
        }
      }
    };

    // Update last active time on user interaction
    const updateLastActiveTime = () => {
      localStorage.setItem("lastActiveTime", Date.now().toString());
    };

    // Set up activity listeners
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(event => {
      window.addEventListener(event, updateLastActiveTime);
    });

    // Initial setup - reset activity time for fresh authentication
    updateLastActiveTime();

    // Set up interval check
    const interval = setInterval(checkSessionActivity, ACTIVITY_CHECK_INTERVAL);

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateLastActiveTime);
      });
      clearInterval(interval);
    };
  }, [user]); // Depend on user so it resets when authentication state changes

  // If auth is prevented, return unauthenticated state
  if (shouldPreventAuth) {
    return {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isAuthChecked: true, // Auth is prevented, so consider it checked
      error: null,
      logout: async () => {},
      refreshUser: async () => {},
    };
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAuthChecked: !isLoading && (!!user || !!error), // Auth has been checked if not loading and we have user or error
    error,
    logout,
    refreshUser,
  };
}

