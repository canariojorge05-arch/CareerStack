// Utility to reset all authentication state and clear loops
import { authCircuitBreaker } from './authCircuitBreaker';
import { authGlobalState } from './authGlobalState';

export function resetAllAuthState() {
  try {
    // Reset circuit breaker
    authCircuitBreaker.reset();
    
    // Reset global state
    authGlobalState.reset();
    
    // Clear localStorage auth-related items
    const authKeys = [
      'lastAuthRedirect',
      'lastPrivateRedirect',
      'authErrorHandledAt',
      'authLastRedirectAt'
    ];
    
    authKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('✅ All auth state reset successfully');
    return true;
  } catch (error) {
    console.error('❌ Error resetting auth state:', error);
    return false;
  }
}

// Note: Auto-reset removed to prevent clearing legitimate sessions
// Loop detection is handled by authGlobalState and circuit breaker
// Manual reset can be triggered via resetAllAuthState() if needed
