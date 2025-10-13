import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Function to fetch CSRF token if not present
async function ensureCSRFToken(): Promise<string | undefined> {
  // Check if token already exists in cookie
  const existingToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf_token='))
    ?.split('=')[1];
  
  if (existingToken) {
    return existingToken;
  }
  
  // If no token, try to get it by making a simple GET request to any API endpoint
  // This should trigger the CSRF middleware to set the token
  try {
    console.log('🔒 Fetching CSRF token by making GET request...');
    const response = await fetch('/api/auth/user', {
      method: 'GET',
      credentials: 'include',
    });
    
    // Don't care about the response, just check if token was set
    const newToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf_token='))
      ?.split('=')[1];
    
    console.log(`🔒 CSRF token after GET request: ${newToken ? 'Success' : 'Failed'}`);
    return newToken;
  } catch (error) {
    console.warn('🔒 Failed to fetch CSRF token:', error);
  }
  
  return undefined;
}

// Function to refresh CSRF token proactively
export async function refreshCSRFToken(): Promise<void> {
  try {
    console.log('🔒 Proactively refreshing CSRF token...');
    // Clear existing token
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    // Fetch new token
    await ensureCSRFToken();
    console.log('🔒 CSRF token refreshed successfully');
  } catch (error) {
    console.warn('🔒 Failed to refresh CSRF token:', error);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get CSRF token for state-changing operations
  const needsCSRF = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  let csrfToken: string | undefined;
  
  if (needsCSRF) {
    csrfToken = await ensureCSRFToken();
    console.log(`🔒 CSRF Debug - Method: ${method}, Token: ${csrfToken ? 'Found' : 'Missing'}, URL: ${url}`);
  }

  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (needsCSRF && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // If we get a CSRF error, try to refresh the token and retry once
  if (!res.ok && res.status === 403 && needsCSRF) {
    try {
      const errorText = await res.text();
      if (errorText.includes('CSRF') || errorText.includes('csrf')) {
        console.log('🔒 CSRF token failed, refreshing and retrying...');
        
        // Clear existing token and fetch a new one
        document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        csrfToken = await ensureCSRFToken();
        
        if (csrfToken) {
          headers["X-CSRF-Token"] = csrfToken;
          console.log('🔒 Retrying with new CSRF token...');
          
          // Retry the request with new token
          res = await fetch(url, {
            method,
            headers,
            body: data ? JSON.stringify(data) : undefined,
            credentials: "include",
          });
        }
      }
    } catch (retryError) {
      console.warn('🔒 CSRF token retry failed:', retryError);
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (res.status === 401) {
      // Temporary debug logging: store timestamps of 401 responses so we can
      // correlate client-side events with server logs when diagnosing session failures.
      try {
        const key = 'auth401Events';
        const raw = localStorage.getItem(key);
        const arr: number[] = raw ? JSON.parse(raw) : [];
        arr.push(Date.now());
        // keep only the most recent 50 entries
        const trimmed = arr.slice(-50);
        localStorage.setItem(key, JSON.stringify(trimmed));
      } catch (e) {
        // ignore storage errors
      }

      console.warn('[auth] Received 401 for', queryKey.join('/'), 'at', new Date().toISOString());

      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // Disable to prevent auth loops
      refetchOnReconnect: false, // Disable to prevent auth loops
      staleTime: 30 * 1000, // 30 seconds - shorter for better performance
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: false, // Disable retries for faster failure
      retryDelay: 0,
      networkMode: 'online', // Fail fast when offline
    },
    mutations: {
      retry: false, // Disable retries for mutations too
      retryDelay: 0,
      networkMode: 'online',
    },
  },
});
