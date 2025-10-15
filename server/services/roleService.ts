import { UserRoleType, UserRole, Permissions } from '@shared/schema';
import { hasPermission, hasRoleLevel } from '../utils/permissions';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

/**
 * Validate if a role assignment is allowed
 */
export const validateRoleAssignment = (
  currentRole: UserRoleType,
  newRole: UserRoleType,
  assignerRole: UserRoleType
): { valid: boolean; reason?: string } => {
  // Only admins can assign roles
  if (!hasPermission(assignerRole, Permissions.ASSIGN_ROLES)) {
    return { 
      valid: false,
      reason: 'Insufficient permissions to assign roles'
    };
  }

  // Cannot assign a role higher than your own
  if (hasRoleLevel(newRole, assignerRole)) {
    return { 
      valid: false,
      reason: 'Cannot assign a role higher than your own'
    };
  }

  // Cannot downgrade an admin if you're not an admin
  if (currentRole === UserRole.ADMIN && assignerRole !== UserRole.ADMIN) {
    return { 
      valid: false,
      reason: 'Only admins can modify admin roles'
    };
  }

  return { valid: true };
};

/**
 * Assign a role to a user with validation
 */
export const assignUserRole = async (
  userId: string,
  newRole: UserRoleType,
  assignerId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Get current user and assigner roles
    const [user, assigner] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, userId) }),
      db.query.users.findFirst({ where: eq(users.id, assignerId) })
    ]);

    if (!user || !assigner) {
      return { success: false, message: 'User or assigner not found' };
    }

    // Validate role assignment
    const validation = validateRoleAssignment(
      user.role as UserRoleType,
      newRole,
      assigner.role as UserRoleType
    );

    if (!validation.valid) {
      logger.warn({
        userId,
        assignerId,
        currentRole: user.role,
        newRole,
        reason: validation.reason
      }, 'Role assignment validation failed');
      return { success: false, message: validation.reason || 'Invalid role assignment' };
    }

    // Update user role
    await db
      .update(users)
      .set({ 
        role: newRole,
        updatedAt: new Date(),
        lastModifiedBy: assignerId
      })
      .where(eq(users.id, userId));

    logger.info({
      userId,
      assignerId,
      oldRole: user.role,
      newRole
    }, 'User role updated successfully');

    return { success: true, message: 'Role updated successfully' };
  } catch (error) {
    logger.error({ error, userId, newRole, assignerId }, 'Role assignment failed');
    return { success: false, message: 'Failed to assign role' };
  }
};