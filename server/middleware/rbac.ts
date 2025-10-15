import { Request, Response, NextFunction } from 'express';
import { UserRoleType, PermissionType, UserRole } from '@shared/schema';
import { hasPermission, hasRoleLevel, hasAllPermissions } from '../utils/permissions';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

/**
 * Get user's role from database
 */
async function getUserRole(userId: string): Promise<UserRoleType> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      role: true
    }
  });
  return user?.role || UserRole.USER;
}

/**
 * Middleware to require a specific role
 */
export const requireRole = (role: UserRoleType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    try {
      const userRole = await getUserRole(req.user.id);
      if (!hasRoleLevel(userRole, role)) {
        logger.warn({ userId: req.user.id, requiredRole: role, userRole }, 'Insufficient role');
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_ROLE'
        });
      }
      
      // Attach role to request for future middleware
      req.user.role = userRole;
      next();
    } catch (error) {
      logger.error({ error, userId: req.user.id }, 'Role check failed');
      res.status(500).json({ 
        message: 'Internal server error',
        code: 'ROLE_CHECK_FAILED'
      });
    }
  };
};

/**
 * Middleware to require specific permission
 */
export const requirePermission = (permission: PermissionType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    try {
      const userRole = await getUserRole(req.user.id);
      if (!hasPermission(userRole, permission)) {
        logger.warn({ userId: req.user.id, requiredPermission: permission, userRole }, 'Permission denied');
        return res.status(403).json({ 
          message: 'Permission denied',
          code: 'PERMISSION_DENIED'
        });
      }
      
      // Attach role to request for future middleware
      req.user.role = userRole;
      next();
    } catch (error) {
      logger.error({ error, userId: req.user.id }, 'Permission check failed');
      res.status(500).json({ 
        message: 'Internal server error',
        code: 'PERMISSION_CHECK_FAILED'
      });
    }
  };
};

/**
 * Middleware to require multiple permissions (all must be present)
 */
export const requireAllPermissions = (permissions: PermissionType[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    try {
      const userRole = await getUserRole(req.user.id);
      if (!hasAllPermissions(userRole, permissions)) {
        logger.warn({ userId: req.user.id, requiredPermissions: permissions, userRole }, 'Insufficient permissions');
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      // Attach role to request for future middleware
      req.user.role = userRole;
      next();
    } catch (error) {
      logger.error({ error, userId: req.user.id }, 'Permission check failed');
      res.status(500).json({ 
        message: 'Internal server error',
        code: 'PERMISSION_CHECK_FAILED'
      });
    }
  };
};