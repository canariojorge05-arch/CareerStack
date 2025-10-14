import { db } from '../db';
import { loginHistory, users } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { logger } from './logger';

interface LoginAttempt {
  ipAddress: string;
  city?: string;
  region?: string;
  country?: string;
  browser: string;
  os: string;
  deviceType: string;
}

interface SuspiciousActivityResult {
  isSuspicious: boolean;
  reasons: string[];
  isNewLocation: boolean;
  isNewDevice: boolean;
}

/**
 * Detect suspicious login activity
 */
export class SuspiciousActivityDetector {
  /**
   * Analyze login attempt and detect suspicious patterns
   */
  static async analyze(userId: string, currentAttempt: LoginAttempt): Promise<SuspiciousActivityResult> {
    const reasons: string[] = [];
    let isNewLocation = false;
    let isNewDevice = false;

    try {
      // Get user's recent login history (last 20 logins)
      const recentLogins = await db.query.loginHistory.findMany({
        where: and(
          eq(loginHistory.userId, userId),
          eq(loginHistory.status, 'success')
        ),
        orderBy: [desc(loginHistory.createdAt)],
        limit: 20
      });

      // If this is the first login, it's not suspicious
      if (recentLogins.length === 0) {
        return {
          isSuspicious: false,
          reasons: [],
          isNewLocation: true,
          isNewDevice: true
        };
      }

      // Check for new location
      const knownLocations = recentLogins
        .filter(l => l.country)
        .map(l => `${l.city}-${l.region}-${l.country}`);
      
      const currentLocation = `${currentAttempt.city}-${currentAttempt.region}-${currentAttempt.country}`;
      
      if (!knownLocations.includes(currentLocation)) {
        isNewLocation = true;
        
        // Check if it's a different country (more suspicious)
        const knownCountries = recentLogins
          .filter(l => l.country)
          .map(l => l.country);
        
        if (currentAttempt.country && !knownCountries.includes(currentAttempt.country)) {
          reasons.push(`Login from new country: ${currentAttempt.country}`);
        } else {
          reasons.push(`Login from new location: ${currentLocation}`);
        }
      }

      // Check for new device
      const knownDevices = recentLogins
        .filter(l => l.browser && l.os)
        .map(l => `${l.browser}-${l.os}-${l.deviceType}`.toLowerCase());
      
      const currentDevice = `${currentAttempt.browser}-${currentAttempt.os}-${currentAttempt.deviceType}`.toLowerCase();
      
      if (!knownDevices.includes(currentDevice)) {
        isNewDevice = true;
        reasons.push(`Login from new device: ${currentAttempt.browser} on ${currentAttempt.os}`);
      }

      // Check for impossible travel
      // If last login was from far away location within short time
      if (recentLogins.length > 0) {
        const lastLogin = recentLogins[0];
        const timeDiff = Date.now() - new Date(lastLogin.createdAt).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // If logged in from different country within 1 hour
        if (hoursDiff < 1 && 
            lastLogin.country && 
            currentAttempt.country && 
            lastLogin.country !== currentAttempt.country) {
          reasons.push(`Impossible travel: ${lastLogin.country} to ${currentAttempt.country} in ${Math.round(hoursDiff * 60)} minutes`);
        }
      }

      // Check for multiple failed attempts from this IP recently
      const recentFailures = await db.query.loginHistory.findMany({
        where: and(
          eq(loginHistory.userId, userId),
          eq(loginHistory.status, 'failed'),
          eq(loginHistory.ipAddress, currentAttempt.ipAddress)
        ),
        orderBy: [desc(loginHistory.createdAt)],
        limit: 5
      });

      if (recentFailures.length >= 3) {
        reasons.push(`Multiple failed login attempts from this IP (${recentFailures.length} failures)`);
      }

      const isSuspicious = reasons.length > 0;

      if (isSuspicious) {
        logger.warn({
          userId,
          reasons,
          currentAttempt
        }, 'Suspicious login activity detected');
      }

      return {
        isSuspicious,
        reasons,
        isNewLocation,
        isNewDevice
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to analyze suspicious activity');
      // Don't block login if analysis fails
      return {
        isSuspicious: false,
        reasons: [],
        isNewLocation: false,
        isNewDevice: false
      };
    }
  }

  /**
   * Send alert to admin about suspicious login
   */
  static async alertAdmin(userId: string, userEmail: string, reasons: string[], loginDetails: LoginAttempt): Promise<void> {
    try {
      const { AuthService } = await import('../services/authService');
      await AuthService.sendSuspiciousLoginAlert(userId, userEmail, reasons, loginDetails);
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send suspicious login alert');
    }
  }

  /**
   * Send notification to user about new device login
   */
  static async notifyUser(userEmail: string, userName: string, loginDetails: LoginAttempt): Promise<void> {
    try {
      const { AuthService } = await import('../services/authService');
      await AuthService.sendNewDeviceLoginEmail(userEmail, userName, loginDetails);
    } catch (error) {
      logger.error({ error, userEmail }, 'Failed to send new device notification');
    }
  }
}
