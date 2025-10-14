import { Request } from 'express';
import { db } from '../db';
import { userActivities } from '@shared/activity';
import { users } from '@shared/schema';
import UAParser from 'ua-parser-js';
import { randomUUID } from 'crypto';
import { eq, desc, count } from 'drizzle-orm';
import { logger } from './logger';

interface ActivityDetails {
  method?: string;
  twoFactor?: boolean;
  [key: string]: any;
}

export class ActivityTracker {
  static async logActivity(
    userId: string,
    activityType: 'login' | 'register' | 'logout' | 'password_reset' | 'email_verification' | 'two_factor_verify',
    status: 'success' | 'failure',
    details: ActivityDetails,
    req: Request
  ) {
    try {
      const userAgent = req.headers['user-agent'];
      const uaParser = new UAParser(userAgent);
      const parsedUA = uaParser.getResult();

      const deviceInfo = {
        browser: parsedUA.browser.name,
        browserVersion: parsedUA.browser.version,
        os: parsedUA.os.name,
        osVersion: parsedUA.os.version,
        device: parsedUA.device.type || 'desktop',
        deviceVendor: parsedUA.device.vendor,
        deviceModel: parsedUA.device.model,
      };

      // Get IP-based location using a free IP geolocation service (gated by env GEO_LOOKUP=on)
      const ipAddress = req.ip || req.socket.remoteAddress;
      let geolocation: any = null;

      if ((process.env.GEO_LOOKUP || '').toLowerCase() === 'on') {
        try {
          const geoResponse = await fetch(`http://ip-api.com/json/${ipAddress}`);
          if (geoResponse.ok) {
            geolocation = await geoResponse.json();
          }
        } catch (error) {
          logger.error({ error: error }, 'Failed to fetch geolocation:');
        }
      }

      // Log activity
      await db.insert(userActivities).values({
        id: randomUUID(),
        userId,
        activityType,
        status,
        details: JSON.stringify(details),
        ipAddress,
        userAgent,
        deviceInfo: JSON.stringify(deviceInfo),
        geolocation: geolocation ? JSON.stringify(geolocation) : null,
      });

      // Update user's last login info if it's a successful login
      if (activityType === 'login' && status === 'success' && geolocation) {
        await db
          .update(users)
          .set({
            lastLoginCity: geolocation.city ?? null,
            lastLoginCountry: geolocation.country ?? null,
            lastLoginBrowser: deviceInfo.browser ?? null,
            lastLoginOs: deviceInfo.os ?? null,
            lastLoginDevice: deviceInfo.device ?? null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      }
    } catch (error) {
      logger.error({ error: error }, 'Failed to log activity:');
      // Don't throw - we don't want to disrupt the main flow if logging fails
    }
  }

  static async getUserActivities(userId: string, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      
      const activities = await db
        .select()
        .from(userActivities)
        .where(eq(userActivities.userId, userId))
        .orderBy(desc(userActivities.createdAt))
        .limit(limit)
        .offset(offset);

      const total = await db
        .select({ count: count(userActivities.id) })
        .from(userActivities)
        .where(eq(userActivities.userId, userId));

      return {
        activities,
        total: total[0].count,
        page,
        limit,
        totalPages: Math.ceil(total[0].count / limit),
      };
    } catch (error) {
      logger.error({ error: error }, 'Failed to fetch user activities:');
      throw error;
    }
  }
}