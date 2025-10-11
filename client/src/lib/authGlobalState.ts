// Global state to prevent auth loops
let authLoopDetected = false;
let authRequestCount = 0;
let lastResetTime = Date.now();
let appStartTime = Date.now();
const APP_STARTUP_GRACE_PERIOD = 15000; // 15 seconds// Enhanced auth loop detection with startup grace period
const authGlobalState = {
  recordAuthRequest: () => {
    const now = Date.now();
    const isAppStartup = now - appStartTime < 20000; // 20 second startup grace period (increased)
    const threshold = isAppStartup ? 30 : 12; // More lenient thresholds
    
    // Reset counter every 15 seconds during startup, 10 seconds otherwise
    const resetInterval = isAppStartup ? 15000 : 10000;
    
    if (now - lastResetTime > resetInterval) {
      authRequestCount = 0;
      authLoopDetected = false;
      localStorage.removeItem('authLoopDetected');
    }
    
    authRequestCount++;
    lastResetTime = now;
    
    // If we've made too many requests, stop
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


  reset(): void {
    authLoopDetected = false;
    authRequestCount = 0;
    lastResetTime = Date.now();
    appStartTime = Date.now(); // Reset app start time on manual reset
  },

  isLoopDetected(): boolean {
    return authLoopDetected;
  },

  shouldPreventAuthRequest(): boolean {
    // Check if auth loop is detected or if we're in localStorage
    const storedLoop = localStorage.getItem('authLoopDetected');
    return authLoopDetected || storedLoop === 'true';
  }
};

export { authGlobalState };
