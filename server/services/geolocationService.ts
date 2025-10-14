import { logger } from '../utils/logger';
/**
 * IP Geolocation Service
 * Uses ip-api.com free API for IP address geolocation
 * Documentation: https://ip-api.com/docs
 * 
 * Free tier: 45 requests per minute
 * No API key required
 */

interface GeolocationData {
  status: 'success' | 'fail';
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  query?: string; // The IP address
}

interface GeolocationResult {
  success: boolean;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
  isp?: string;
  latitude?: string;
  longitude?: string;
  ipAddress: string;
}

export class GeolocationService {
  private static readonly API_URL = 'http://ip-api.com/json';
  private static readonly TIMEOUT = 5000; // 5 seconds
  private static cache = new Map<string, { data: GeolocationResult; timestamp: number }>();
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get geolocation data for an IP address
   * Uses cache to avoid hitting rate limits
   */
  static async getLocation(ipAddress: string): Promise<GeolocationResult> {
    // Return default for localhost/private IPs
    if (this.isPrivateIP(ipAddress)) {
      return {
        success: true,
        city: 'Local',
        region: 'Local',
        country: 'Local Network',
        countryCode: 'LOCAL',
        ipAddress
      };
    }

    // Check cache first
    const cached = this.cache.get(ipAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.info(`📍 Geolocation cache hit for IP: ${ipAddress}`);
      return cached.data;
    }

    try {
      // Call ip-api.com
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

      const response = await fetch(`${this.API_URL}/${ipAddress}`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Geolocation API returned ${response.status}`);
      }

      const data: GeolocationData = await response.json();

      if (data.status === 'fail') {
        logger.warn(`Geolocation failed for ${ipAddress}: ${data.message}`);
        return {
          success: false,
          ipAddress
        };
      }

      const result: GeolocationResult = {
        success: true,
        city: data.city,
        region: data.regionName || data.region,
        country: data.country,
        countryCode: data.countryCode,
        timezone: data.timezone,
        isp: data.isp,
        latitude: data.lat?.toString(),
        longitude: data.lon?.toString(),
        ipAddress
      };

      // Cache the result
      this.cache.set(ipAddress, {
        data: result,
        timestamp: Date.now()
      });

      logger.info(`📍 Geolocation fetched for ${ipAddress}: ${data.city}, ${data.regionName}, ${data.country}`);

      return result;
    } catch (error: any) {
      logger.error(`Failed to get geolocation for ${ipAddress}:`, error.message);
      return {
        success: false,
        ipAddress
      };
    }
  }

  /**
   * Check if IP is private/local
   */
  private static isPrivateIP(ip: string): boolean {
    if (!ip || ip === 'unknown' || ip === '::1' || ip === 'localhost') {
      return true;
    }

    // Check for private IP ranges
    const parts = ip.split('.');
    if (parts.length !== 4) return true; // IPv6 or invalid

    const first = parseInt(parts[0], 10);
    const second = parseInt(parts[1], 10);

    // 10.x.x.x
    if (first === 10) return true;

    // 172.16.x.x to 172.31.x.x
    if (first === 172 && second >= 16 && second <= 31) return true;

    // 192.168.x.x
    if (first === 192 && second === 168) return true;

    // 127.x.x.x (localhost)
    if (first === 127) return true;

    return false;
  }

  /**
   * Clear old cache entries (run periodically)
   */
  static clearOldCache(): void {
    const now = Date.now();
    let cleared = 0;

    for (const [ip, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(ip);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info(`🧹 Cleared ${cleared} old geolocation cache entries`);
    }
  }

  /**
   * Get cache size
   */
  static getCacheSize(): number {
    return this.cache.size;
  }
}

// Clear old cache entries every hour
setInterval(() => {
  GeolocationService.clearOldCache();
}, 60 * 60 * 1000);
