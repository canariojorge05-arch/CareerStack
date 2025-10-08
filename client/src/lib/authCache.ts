// Simple in-memory auth cache for faster subsequent checks
interface AuthCacheEntry {
  isAuthenticated: boolean;
  user: any;
  timestamp: number;
  expires: number;
}

class AuthCache {
  private cache: AuthCacheEntry | null = null;
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds

  set(isAuthenticated: boolean, user: any = null) {
    const now = Date.now();
    this.cache = {
      isAuthenticated,
      user,
      timestamp: now,
      expires: now + this.CACHE_DURATION
    };
  }

  get(): { isAuthenticated: boolean; user: any } | null {
    if (!this.cache) return null;
    
    const now = Date.now();
    if (now > this.cache.expires) {
      this.clear();
      return null;
    }
    
    return {
      isAuthenticated: this.cache.isAuthenticated,
      user: this.cache.user
    };
  }

  clear() {
    this.cache = null;
  }

  isValid(): boolean {
    if (!this.cache) return false;
    return Date.now() <= this.cache.expires;
  }
}

export const authCache = new AuthCache();
