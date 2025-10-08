// Simple circuit breaker to prevent infinite auth loops
class AuthCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private isOpen = false;
  private readonly maxFailures = 3;
  private readonly resetTimeout = 30000; // 30 seconds

  shouldAllowRequest(): boolean {
    const now = Date.now();
    
    // Reset if enough time has passed
    if (this.isOpen && (now - this.lastFailureTime) > this.resetTimeout) {
      this.reset();
    }
    
    return !this.isOpen;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.maxFailures) {
      this.isOpen = true;
      console.log('🚨 Auth circuit breaker opened - too many failures');
    }
  }

  recordSuccess(): void {
    this.reset();
  }

  reset(): void {
    this.failureCount = 0;
    this.isOpen = false;
    this.lastFailureTime = 0;
  }

  isCircuitOpen(): boolean {
    return this.isOpen;
  }
}

export const authCircuitBreaker = new AuthCircuitBreaker();
