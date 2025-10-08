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

// Auto-reset on page load if needed
if (typeof window !== 'undefined') {
  // Reset auth state on page load to prevent persistent loops
  window.addEventListener('load', () => {
    resetAllAuthState();
  });
}
