// Global state to prevent auth loops
let authLoopDetected = false;
let authRequestCount = 0;
let lastResetTime = Date.now();
let appStartTime = Date.now();
const APP_STARTUP_GRACE_PERIOD = 10000; // 10 seconds grace period for app startup

export const authGlobalState = {
  shouldPreventAuthRequest(): boolean {
    const now = Date.now();
    
    // During app startup (first 10 seconds), be more lenient
    const isAppStartup = (now - appStartTime) < APP_STARTUP_GRACE_PERIOD;
    
    // Reset counter every 5 seconds
    if (now - lastResetTime > 5000) {
      authRequestCount = 0;
      authLoopDetected = false;
      lastResetTime = now;
    }
    
    // More lenient threshold during startup (10 requests), stricter after (5 requests)
    const threshold = isAppStartup ? 10 : 5;
    
    // If we've made too many requests in 5 seconds, stop
    if (authRequestCount > threshold) {
      authLoopDetected = true;
      localStorage.setItem('authLoopDetected', 'true');
      console.warn('🚨 Auth loop detected - blocking further requests', {
        count: authRequestCount,
        threshold,
        isStartup: isAppStartup
      });
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
    appStartTime = Date.now(); // Reset app start time on manual reset
  },

  isLoopDetected(): boolean {
    return authLoopDetected;
  }
};
