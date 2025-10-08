// Authentication debugging and loop prevention utilities

interface AuthEvent {
  type: 'error' | 'redirect' | 'retry' | 'fetch';
  timestamp: number;
  path: string;
  message?: string;
}

const MAX_EVENTS = 20;
const LOOP_DETECTION_WINDOW = 10000; // 10 seconds
const MAX_EVENTS_IN_WINDOW = 5;

export class AuthDebugger {
  private static events: AuthEvent[] = [];

  static logEvent(type: AuthEvent['type'], message?: string) {
    const event: AuthEvent = {
      type,
      timestamp: Date.now(),
      path: window.location.pathname,
      message
    };

    this.events.push(event);
    
    // Keep only recent events
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Auth Debug [${type}]:`, message || '', `at ${event.path}`);
    }
  }

  static isInLoop(): boolean {
    const now = Date.now();
    const recentEvents = this.events.filter(
      event => now - event.timestamp < LOOP_DETECTION_WINDOW
    );

    // Check for too many errors in a short time
    const errorCount = recentEvents.filter(e => e.type === 'error').length;
    const redirectCount = recentEvents.filter(e => e.type === 'redirect').length;
    const retryCount = recentEvents.filter(e => e.type === 'retry').length;

    return (
      errorCount > MAX_EVENTS_IN_WINDOW ||
      redirectCount > 3 ||
      retryCount > MAX_EVENTS_IN_WINDOW
    );
  }

  static getRecentEvents(): AuthEvent[] {
    const now = Date.now();
    return this.events.filter(
      event => now - event.timestamp < LOOP_DETECTION_WINDOW
    );
  }

  static reset() {
    this.events = [];
  }

  static shouldPreventAction(actionType: 'redirect' | 'retry' | 'toast'): boolean {
    if (this.isInLoop()) {
      this.logEvent('error', `Prevented ${actionType} due to detected loop`);
      return true;
    }
    return false;
  }
}

// Throttling utility for preventing spam
export class ActionThrottler {
  private static lastActions: Map<string, number> = new Map();

  static shouldAllow(actionKey: string, minInterval: number = 5000): boolean {
    const now = Date.now();
    const lastTime = this.lastActions.get(actionKey) || 0;
    
    if (now - lastTime < minInterval) {
      return false;
    }
    
    this.lastActions.set(actionKey, now);
    return true;
  }

  static reset(actionKey?: string) {
    if (actionKey) {
      this.lastActions.delete(actionKey);
    } else {
      this.lastActions.clear();
    }
  }
}
