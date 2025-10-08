import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get CSRF token for state-changing operations
  const needsCSRF = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  const csrfToken = needsCSRF ? document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf_token='))
    ?.split('=')[1] : undefined;

  // Debug logging for CSRF token
  if (needsCSRF) {
    console.log(`🔒 CSRF Debug - Method: ${method}, Token: ${csrfToken ? 'Found' : 'Missing'}`);
  }

  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (needsCSRF && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

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
