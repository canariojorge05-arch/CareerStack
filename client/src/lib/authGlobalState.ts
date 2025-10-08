// Global state to prevent auth loops
let authLoopDetected = false;
let authRequestCount = 0;
let lastResetTime = Date.now();

export const authGlobalState = {
  shouldPreventAuthRequest(): boolean {
    const now = Date.now();
    
    // Reset counter every 5 seconds (shorter window)
    if (now - lastResetTime > 5000) {
      authRequestCount = 0;
      authLoopDetected = false;
      lastResetTime = now;
    }
    
    // If we've made more than 3 requests in 5 seconds, stop (more conservative)
    if (authRequestCount > 3) {
      authLoopDetected = true;
      localStorage.setItem('authLoopDetected', 'true');
      console.log('🚨 Auth loop detected - blocking further requests');
      return true;
    }
    
    return authLoopDetected;
  },

  recordAuthRequest(): void {
    authRequestCount++;
  },

  reset(): void {
    authLoopDetected = false;
    authRequestCount = 0;
    lastResetTime = Date.now();
  },

  isLoopDetected(): boolean {
    return authLoopDetected;
  }
};
