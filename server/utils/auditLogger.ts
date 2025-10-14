import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from './logger';

/**
 * Audit Log System
 * Tracks all data modifications for compliance and security
 */

export interface AuditLogEntry {
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';
  entityType: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an action to the audit trail
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    // Insert audit log into database
    // Note: This requires the audit_logs table to exist
    // For now, we'll log to console and database if table exists
    
    logger.info('📋 Audit Log:', {
      timestamp: new Date().toISOString(),
      userId: entry.userId,
      action: entry.action,
      entity: `${entry.entityType}/${entry.entityId}`,
      ip: entry.ipAddress,
    });
    
    // Try to insert into database (will fail silently if table doesn't exist)
    try {
      await db.execute(sql`
        INSERT INTO audit_logs (
          user_id, 
          action, 
          entity_type, 
          entity_id, 
          old_value, 
          new_value,
          ip_address,
          user_agent,
          metadata,
          created_at
        ) VALUES (
          ${entry.userId},
          ${entry.action},
          ${entry.entityType},
          ${entry.entityId},
          ${entry.oldValue ? JSON.stringify(entry.oldValue) : null}::jsonb,
          ${entry.newValue ? JSON.stringify(entry.newValue) : null}::jsonb,
          ${entry.ipAddress || null},
          ${entry.userAgent || null},
          ${entry.metadata ? JSON.stringify(entry.metadata) : null}::jsonb,
          NOW()
        )
      `);
    } catch (dbError: any) {
      // If table doesn't exist, log to file/console only
      if (!dbError.message?.includes('does not exist')) {
        logger.error({ error: dbError.message }, 'Failed to write audit log to database:');
      }
    }
  } catch (error) {
    // Never fail the main operation due to audit logging
    logger.error({ error: error }, 'Audit logging error:');
  }
}

/**
 * Log a CREATE action
 */
export async function logCreate(
  userId: string,
  entityType: string,
  entityId: string,
  data: any,
  req?: any
): Promise<void> {
  await logAudit({
    userId,
    action: 'CREATE',
    entityType,
    entityId,
    newValue: sanitizeForLog(data),
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.headers?.[' user-agent'],
  });
}

/**
 * Log an UPDATE action
 */
export async function logUpdate(
  userId: string,
  entityType: string,
  entityId: string,
  oldData: any,
  newData: any,
  req?: any
): Promise<void> {
  await logAudit({
    userId,
    action: 'UPDATE',
    entityType,
    entityId,
    oldValue: sanitizeForLog(oldData),
    newValue: sanitizeForLog(newData),
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.headers?.['user-agent'],
  });
}

/**
 * Log a DELETE action
 */
export async function logDelete(
  userId: string,
  entityType: string,
  entityId: string,
  data: any,
  req?: any
): Promise<void> {
  await logAudit({
    userId,
    action: 'DELETE',
    entityType,
    entityId,
    oldValue: sanitizeForLog(data),
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.headers?.['user-agent'],
  });
}

/**
 * Log a VIEW action (for sensitive data access)
 */
export async function logView(
  userId: string,
  entityType: string,
  entityId: string,
  req?: any
): Promise<void> {
  await logAudit({
    userId,
    action: 'VIEW',
    entityType,
    entityId,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.headers?.['user-agent'],
  });
}

/**
 * Remove sensitive fields from audit logs
 */
function sanitizeForLog(data: any): any {
  if (!data) return data;
  
  const sanitized = { ...data };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'password',
    'accessToken',
    'refreshToken',
    'twoFactorSecret',
    'twoFactorRecoveryCodes',
  ];
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  // Mask SSN if present
  if (sanitized.ssn) {
    sanitized.ssn = maskSSN(sanitized.ssn);
  }
  
  return sanitized;
}

/**
 * Mask SSN for audit logs
 */
function maskSSN(ssn: string): string {
  if (!ssn) return '';
  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***-**-${digits.slice(-4)}`;
}

/**
 * Get audit trail for an entity
 */
export async function getAuditTrail(
  entityType: string,
  entityId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const result = await db.execute(sql`
      SELECT 
        user_id,
        action,
        entity_type,
        entity_id,
        old_value,
        new_value,
        ip_address,
        created_at
      FROM audit_logs
      WHERE entity_type = ${entityType}
        AND entity_id = ${entityId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    
    return result.rows || [];
  } catch (error) {
    logger.error({ error: error }, 'Failed to fetch audit trail:');
    return [];
  }
}
