import UAParser from 'ua-parser-js';
import { logger } from './logger';

interface DeviceInfo {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: string;
  deviceVendor: string;
}

/**
 * Parse User Agent string to extract device information
 */
export class DeviceParser {
  /**
   * Parse user agent and return structured device info
   */
  static parse(userAgent: string): DeviceInfo {
    if (!userAgent) {
      return this.getDefaultInfo();
    }

    try {
      const parser = new UAParser(userAgent);
      const result = parser.getResult();

      return {
        browser: result.browser.name || 'Unknown',
        browserVersion: result.browser.version || 'Unknown',
        os: result.os.name || 'Unknown',
        osVersion: result.os.version || 'Unknown',
        deviceType: this.getDeviceType(result.device.type),
        deviceVendor: result.device.vendor || 'Unknown'
      };
    } catch (error) {
      logger.error({ error: error }, 'Failed to parse user agent:');
      return this.getDefaultInfo();
    }
  }

  /**
   * Get default device info when parsing fails
   */
  private static getDefaultInfo(): DeviceInfo {
    return {
      browser: 'Unknown',
      browserVersion: 'Unknown',
      os: 'Unknown',
      osVersion: 'Unknown',
      deviceType: 'Unknown',
      deviceVendor: 'Unknown'
    };
  }

  /**
   * Normalize device type
   */
  private static getDeviceType(type?: string): string {
    if (!type) return 'desktop';
    
    const normalized = type.toLowerCase();
    
    if (normalized === 'mobile') return 'mobile';
    if (normalized === 'tablet') return 'tablet';
    if (normalized.includes('console')) return 'console';
    if (normalized.includes('tv')) return 'tv';
    if (normalized.includes('wearable')) return 'wearable';
    
    return 'desktop';
  }

  /**
   * Get a simple device fingerprint (for detecting new devices)
   */
  static getDeviceFingerprint(deviceInfo: DeviceInfo): string {
    return `${deviceInfo.browser}-${deviceInfo.os}-${deviceInfo.deviceType}`.toLowerCase();
  }

  /**
   * Format device info for display
   */
  static formatForDisplay(deviceInfo: DeviceInfo): string {
    const parts = [];
    
    if (deviceInfo.browser !== 'Unknown') {
      parts.push(deviceInfo.browser);
      if (deviceInfo.browserVersion !== 'Unknown') {
        parts.push(deviceInfo.browserVersion);
      }
    }
    
    parts.push('on');
    
    if (deviceInfo.os !== 'Unknown') {
      parts.push(deviceInfo.os);
      if (deviceInfo.osVersion !== 'Unknown') {
        parts.push(deviceInfo.osVersion);
      }
    }
    
    if (deviceInfo.deviceType !== 'desktop' && deviceInfo.deviceType !== 'Unknown') {
      parts.push(`(${deviceInfo.deviceType})`);
    }
    
    return parts.join(' ');
  }
}
