import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, desc, like, or, sql, count } from 'drizzle-orm';
import { isAuthenticated } from '../localAuth';
import { requireRole } from '../middleware/auth';
import { UserRole, UserRoleType } from '@shared/schema';
import { isValidRole, getRoleDisplayName, getAllRoles } from '../utils/permissions';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router();

// All routes require authentication and admin role
router.use(isAuthenticated);
router.use(requireRole(UserRole.ADMIN));

// Validation schemas
const updateRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum([UserRole.USER, UserRole.MARKETING, UserRole.ADMIN])
});

const searchUsersSchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

/**
 * GET /api/admin/users
 * Get all users with pagination and filtering
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { search, role, page = '1', limit = '20' } = searchUsersSchema.parse(req.query);
    
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          like(users.email, `%${search}%`),
          like(users.firstName, `%${search}%`),
          like(users.lastName, `%${search}%`)
        )
      );
    }
    
    if (role && isValidRole(role)) {
      conditions.push(eq(users.role, role as UserRoleType));
    }

    const whereClause = conditions.length > 0 
      ? conditions.length === 1 
        ? conditions[0] 
        : sql`${conditions[0]} AND ${conditions[1]}`
      : undefined;

    // Get users with pagination
    const usersList = await db.query.users.findMany({
      where: whereClause,
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true
      },
      orderBy: [desc(users.createdAt)],
      limit: limitNum,
      offset: offset
    });

    // Get total count for pagination
    const totalQuery = whereClause
      ? await db.select({ count: count() }).from(users).where(whereClause)
      : await db.select({ count: count() }).from(users);
    
    const total = totalQuery[0]?.count || 0;

    logger.info({ 
      adminId: req.user?.id, 
      total, 
      page: pageNum, 
      search, 
      role 
    }, 'Admin fetched users list');

    res.json({
      users: usersList,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limitNum)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid request parameters', 
        errors: error.errors 
      });
    }
    
    logger.error({ error, adminId: req.user?.id }, 'Failed to fetch users');
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

/**
 * GET /api/admin/users/:id
 * Get specific user details
 */
router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        password: false, // Exclude password
        twoFactorSecret: false, // Exclude 2FA secret
        twoFactorRecoveryCodes: false, // Exclude recovery codes
        emailVerificationToken: false,
        passwordResetToken: false
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info({ 
      adminId: req.user?.id, 
      targetUserId: id 
    }, 'Admin viewed user details');

    res.json(user);
  } catch (error) {
    logger.error({ error, adminId: req.user?.id, userId: req.params.id }, 'Failed to fetch user');
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Update user role (admin only)
 */
router.patch('/users/:id/role', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = updateRoleSchema.parse({ userId: id, ...req.body });

    // Check if user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        email: true,
        role: true
      }
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self-demotion from admin
    if (targetUser.id === req.user?.id && role !== UserRole.ADMIN) {
      return res.status(400).json({ 
        message: 'Cannot change your own admin role',
        code: 'SELF_DEMOTION_PREVENTED'
      });
    }

    // Update user role
    await db.update(users)
      .set({ 
        role: role,
        updatedAt: new Date()
      })
      .where(eq(users.id, id));

    logger.info({ 
      adminId: req.user?.id,
      targetUserId: id,
      oldRole: targetUser.role,
      newRole: role
    }, 'Admin updated user role');

    res.json({ 
      message: 'User role updated successfully',
      user: {
        id: targetUser.id,
        email: targetUser.email,
        role: role
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid request data', 
        errors: error.errors 
      });
    }
    
    logger.error({ error, adminId: req.user?.id, userId: req.params.id }, 'Failed to update user role');
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

/**
 * GET /api/admin/stats
 * Get user statistics by role
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Get count by role
    const roleStats = await db
      .select({
        role: users.role,
        count: count()
      })
      .from(users)
      .groupBy(users.role);

    // Get recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUsersQuery = await db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.createdAt} >= ${sevenDaysAgo}`);
    
    const recentUsers = recentUsersQuery[0]?.count || 0;

    // Get total users
    const totalUsersQuery = await db.select({ count: count() }).from(users);
    const totalUsers = totalUsersQuery[0]?.count || 0;

    logger.info({ 
      adminId: req.user?.id 
    }, 'Admin fetched user statistics');

    res.json({
      total: Number(totalUsers),
      recentUsers: Number(recentUsers),
      byRole: roleStats.map(stat => ({
        role: stat.role,
        roleName: getRoleDisplayName(stat.role as UserRoleType),
        count: Number(stat.count)
      }))
    });
  } catch (error) {
    logger.error({ error, adminId: req.user?.id }, 'Failed to fetch user statistics');
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/admin/roles
 * Get all available roles
 */
router.get('/roles', async (req: Request, res: Response) => {
  try {
    const roles = getAllRoles().map(role => ({
      value: role,
      label: getRoleDisplayName(role),
      description: role === UserRole.USER 
        ? 'Standard user with basic access'
        : role === UserRole.MARKETING
        ? 'Access to marketing features'
        : 'Full system administrator'
    }));

    res.json(roles);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch roles');
    res.status(500).json({ message: 'Failed to fetch roles' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user (admin only) - use with caution
 */
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        email: true,
        role: true
      }
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self-deletion
    if (targetUser.id === req.user?.id) {
      return res.status(400).json({ 
        message: 'Cannot delete your own account',
        code: 'SELF_DELETION_PREVENTED'
      });
    }

    // Delete user (cascade will handle related records)
    await db.delete(users).where(eq(users.id, id));

    logger.warn({ 
      adminId: req.user?.id,
      deletedUserId: id,
      deletedUserEmail: targetUser.email
    }, 'Admin deleted user');

    res.json({ 
      message: 'User deleted successfully',
      deletedUser: {
        id: targetUser.id,
        email: targetUser.email
      }
    });
  } catch (error) {
    logger.error({ error, adminId: req.user?.id, userId: req.params.id }, 'Failed to delete user');
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

export default router;
