import { db } from '../db';
import { auditLogs } from '@shared/schema';
import { UserRoleType } from '@shared/schema';
import { logger } from '../utils/logger';

export interface AuditLogEntry {
  userId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  changedBy: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Record a role change in the audit log
 */
export const auditRoleChange = async (
  userId: string,
  oldRole: UserRoleType,
  newRole: UserRoleType,
  changedBy: string,
  metadata?: Record<string, any>
): Promise<void> => {
  try {
    await db.insert(auditLogs).values({
      userId,
      action: 'ROLE_CHANGE',
      entityType: 'user',
      entityId: userId,
      oldValue: { role: oldRole },
      newValue: { role: newRole },
      metadata: {
        ...metadata || {},
        changedBy
      },
      createdAt: new Date()
    });

    logger.info({
      userId,
      changedBy,
      oldRole,
      newRole,
      metadata
    }, 'Role change audit logged');
  } catch (error) {
    logger.error({
      error,
      userId,
      changedBy,
      oldRole,
      newRole
    }, 'Failed to log role change audit');
    throw error;
  }
};

/**
 * Record a permission usage attempt in the audit log
 */
export const auditPermissionAttempt = async (
  userId: string,
  permission: string,
  granted: boolean,
  metadata?: Record<string, any>
): Promise<void> => {
  try {
    await db.insert(auditLogs).values({
      userId,
      action: granted ? 'PERMISSION_GRANTED' : 'PERMISSION_DENIED',
      entityType: 'permission',
      entityId: permission,
      oldValue: null,
      newValue: { granted },
      metadata: metadata || {},
      createdAt: new Date()
    });

    logger.info({
      userId,
      permission,
      granted,
      metadata
    }, 'Permission attempt audit logged');
  } catch (error) {
    logger.error({
      error,
      userId,
      permission,
      granted
    }, 'Failed to log permission attempt');
    // Don't throw error for permission logging - non-critical
  }
};