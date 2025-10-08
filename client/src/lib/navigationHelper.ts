// Navigation helper to preserve auth state during browser navigation
export class NavigationHelper {
  private static isNavigating = false;
  private static navigationTimer: NodeJS.Timeout | null = null;

  static markNavigationStart() {
    this.isNavigating = true;
    
    // Clear any existing timer
    if (this.navigationTimer) {
      clearTimeout(this.navigationTimer);
    }
    
    // Mark navigation as complete after a short delay
    this.navigationTimer = setTimeout(() => {
      this.isNavigating = false;
    }, 500); // 500ms should be enough for most navigation
  }

  static isCurrentlyNavigating(): boolean {
    return this.isNavigating;
  }

  static shouldPreventAuthRedirect(): boolean {
    // Don't redirect during navigation or shortly after
    return this.isNavigating;
  }
}

// Listen for browser navigation events
if (typeof window !== 'undefined') {
  // Mark navigation start on popstate (back/forward buttons)
  window.addEventListener('popstate', () => {
    NavigationHelper.markNavigationStart();
  });
  
  // Mark navigation start on beforeunload
  window.addEventListener('beforeunload', () => {
    NavigationHelper.markNavigationStart();
  });
}
