// Debug utilities for troubleshooting startup errors

export function logStartupInfo() {
  if (process.env.NODE_ENV === 'development') {
    console.group('🚀 App Startup Debug Info');
    
    // Environment info
    console.log('Environment:', import.meta.env.MODE);
    console.log('Base URL:', import.meta.env.BASE_URL);
    console.log('Dev mode:', import.meta.env.DEV);
    console.log('Prod mode:', import.meta.env.PROD);
    
    // Browser info
    console.log('User Agent:', navigator.userAgent);
    console.log('URL:', window.location.href);
    console.log('Local Storage available:', isLocalStorageAvailable());
    console.log('Session Storage available:', isSessionStorageAvailable());
    
    // Check for previous errors
    const previousErrors = getPreviousErrors();
    if (previousErrors.length > 0) {
      console.warn('Previous errors found:', previousErrors);
    }
    
    console.groupEnd();
  }
}

export function isLocalStorageAvailable(): boolean {
  try {
    const test = '__test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function isSessionStorageAvailable(): boolean {
  try {
    const test = '__test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function getPreviousErrors(): any[] {
  try {
    return JSON.parse(localStorage.getItem('appErrors') || '[]');
  } catch {
    return [];
  }
}

export function clearPreviousErrors(): void {
  try {
    localStorage.removeItem('appErrors');
    localStorage.removeItem('auth401Events');
    localStorage.removeItem('authErrorHandledAt');
    localStorage.removeItem('authLastRedirectAt');
  } catch {
    // Ignore errors
  }
}

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Log to localStorage for debugging
  try {
    const errorLog = {
      type: 'unhandledrejection',
      reason: event.reason?.toString() || 'Unknown',
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };
    
    const existingErrors = JSON.parse(localStorage.getItem('appErrors') || '[]');
    existingErrors.push(errorLog);
    const recentErrors = existingErrors.slice(-10);
    localStorage.setItem('appErrors', JSON.stringify(recentErrors));
  } catch {
    // Ignore localStorage errors
  }
});

// Global error handler for JavaScript errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  
  // Log to localStorage for debugging
  try {
    const errorLog = {
      type: 'javascript',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };
    
    const existingErrors = JSON.parse(localStorage.getItem('appErrors') || '[]');
    existingErrors.push(errorLog);
    const recentErrors = existingErrors.slice(-10);
    localStorage.setItem('appErrors', JSON.stringify(recentErrors));
  } catch {
    // Ignore localStorage errors
  }
});
