import { db } from '../db';
import { accountActivityLogs } from '@shared/schema';
import { logger } from './logger';

export async function logAccountActivity(userId: string, activityType: string, status: string, metadata?: any) {
  try {
    await db.insert(accountActivityLogs).values({
      id: undefined,
      userId,
      activityType,
      status,
      metadata: metadata || {},
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
    }).returning();
  } catch (e) {
    logger.warn({ context: e }, 'Failed to write account activity log');
  }
}
