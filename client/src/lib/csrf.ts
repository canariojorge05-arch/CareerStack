/**
 * CSRF Token Utility
 * Provides helper functions for handling CSRF tokens in API requests
 */

/**
 * Get CSRF token from browser cookies
 * @returns CSRF token string or empty string if not found
 */
export function getCsrfToken(): string {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf_token='))
    ?.split('=')[1] || '';
}

/**
 * Create headers object with CSRF token
 * @param additionalHeaders - Additional headers to include
 * @returns Headers object with CSRF token
 */
export function createCsrfHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    'X-CSRF-Token': getCsrfToken(),
    ...additionalHeaders,
  };
}

/**
 * Make an authenticated API request with CSRF protection
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Promise<Response>
 */
export async function csrfFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = createCsrfHeaders(
    options.headers ? Object.fromEntries(Object.entries(options.headers)) : {}
  );

  return fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });
}
