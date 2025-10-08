import { db } from '../db';
import { accountActivityLogs } from '@shared/schema';

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
    console.warn('Failed to write account activity log', e);
  }
}
