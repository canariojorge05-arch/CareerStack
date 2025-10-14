import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, ApprovalStatus } from '@shared/schema';
import { eq, and, or, desc, count } from 'drizzle-orm';
import { isAuthenticated } from '../localAuth';
import { requireRole } from '../middleware/auth';
import { UserRole } from '@shared/schema';
import { logger } from '../utils/logger';
import { z } from 'zod';

const router = Router();

// All routes require authentication and admin role
router.use(isAuthenticated);
router.use(requireRole(UserRole.ADMIN));

// Validation schemas
const approveUserSchema = z.object({
  userId: z.string().uuid('Invalid user ID')
});

const rejectUserSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  reason: z.string().optional()
});

const bulkApproveSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, 'At least one user ID required')
});

/**
 * GET /api/admin/pending-approvals
 * Get all users pending admin approval
 */
router.get('/pending-approvals', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    let whereClause = eq(users.approvalStatus, ApprovalStatus.PENDING_APPROVAL);
    
    if (search) {
      whereClause = and(
        whereClause,
        or(
          eq(users.email, search as string),
          eq(users.firstName, search as string),
          eq(users.lastName, search as string)
        )
      ) as any;
    }

    // Get pending users
    const pendingUsers = await db.query.users.findMany({
      where: whereClause,
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        createdAt: true,
        lastIpAddress: true,
        approvalStatus: true
      },
      orderBy: [desc(users.createdAt)],
      limit: limitNum,
      offset: offset
    });

    // Get total count
    const totalQuery = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);
    
    const total = totalQuery[0]?.count || 0;

    logger.info({ 
      adminId: req.user?.id, 
      total, 
      page: pageNum 
    }, 'Admin fetched pending approvals');

    res.json({
      users: pendingUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limitNum)
      }
    });
  } catch (error) {
    logger.error({ error, adminId: req.user?.id }, 'Failed to fetch pending approvals');
    res.status(500).json({ message: 'Failed to fetch pending approvals' });
  }
});

/**
 * GET /api/admin/approval-stats
 * Get statistics about user approvals
 */
router.get('/approval-stats', async (req: Request, res: Response) => {
  try {
    // Get counts by status
    const statusCounts = await db
      .select({
        status: users.approvalStatus,
        count: count()
      })
      .from(users)
      .groupBy(users.approvalStatus);

    // Get today's pending count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayPendingQuery = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.approvalStatus, ApprovalStatus.PENDING_APPROVAL),
          eq(users.createdAt, today as any)
        )
      );

    const todayPending = todayPendingQuery[0]?.count || 0;

    const stats = {
      byStatus: statusCounts.map(s => ({
        status: s.status,
        count: Number(s.count)
      })),
      todayPending: Number(todayPending)
    };

    logger.info({ adminId: req.user?.id }, 'Admin fetched approval stats');

    res.json(stats);
  } catch (error) {
    logger.error({ error, adminId: req.user?.id }, 'Failed to fetch approval stats');
    res.status(500).json({ message: 'Failed to fetch approval stats' });
  }
});

/**
 * POST /api/admin/users/:id/approve
 * Approve a pending user
 */
router.post('/users/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({ message: 'Admin ID not found' });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        approvalStatus: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.approvalStatus !== ApprovalStatus.PENDING_APPROVAL) {
      return res.status(400).json({ 
        message: `User is not pending approval. Current status: ${user.approvalStatus}` 
      });
    }

    // Approve user
    await db.update(users)
      .set({
        approvalStatus: ApprovalStatus.APPROVED,
        approvedBy: adminId,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, id));

    // Send approval email
    try {
      const { AuthService } = await import('../services/authService');
      await AuthService.sendApprovalEmail(user.email, user.firstName || 'User');
    } catch (emailError) {
      logger.error({ error: emailError }, 'Failed to send approval email');
      // Don't fail the approval if email fails
    }

    logger.info({ 
      adminId, 
      userId: id, 
      userEmail: user.email 
    }, 'Admin approved user');

    res.json({ 
      message: 'User approved successfully',
      user: {
        id: user.id,
        email: user.email,
        approvalStatus: ApprovalStatus.APPROVED
      }
    });
  } catch (error) {
    logger.error({ error, adminId: req.user?.id, userId: req.params.id }, 'Failed to approve user');
    res.status(500).json({ message: 'Failed to approve user' });
  }
});

/**
 * POST /api/admin/users/:id/reject
 * Reject a pending user
 */
router.post('/users/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = rejectUserSchema.parse({ userId: id, ...req.body });
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({ message: 'Admin ID not found' });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        approvalStatus: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.approvalStatus !== ApprovalStatus.PENDING_APPROVAL) {
      return res.status(400).json({ 
        message: `User is not pending approval. Current status: ${user.approvalStatus}` 
      });
    }

    // Reject user
    await db.update(users)
      .set({
        approvalStatus: ApprovalStatus.REJECTED,
        rejectedBy: adminId,
        rejectedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date()
      })
      .where(eq(users.id, id));

    // Send rejection email
    try {
      const { AuthService } = await import('../services/authService');
      await AuthService.sendRejectionEmail(user.email, user.firstName || 'User', reason);
    } catch (emailError) {
      logger.error({ error: emailError }, 'Failed to send rejection email');
      // Don't fail the rejection if email fails
    }

    logger.warn({ 
      adminId, 
      userId: id, 
      userEmail: user.email,
      reason 
    }, 'Admin rejected user');

    res.json({ 
      message: 'User rejected',
      user: {
        id: user.id,
        email: user.email,
        approvalStatus: ApprovalStatus.REJECTED
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid request data', 
        errors: error.errors 
      });
    }
    
    logger.error({ error, adminId: req.user?.id, userId: req.params.id }, 'Failed to reject user');
    res.status(500).json({ message: 'Failed to reject user' });
  }
});

/**
 * POST /api/admin/users/bulk-approve
 * Approve multiple users at once
 */
router.post('/users/bulk-approve', async (req: Request, res: Response) => {
  try {
    const { userIds } = bulkApproveSchema.parse(req.body);
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({ message: 'Admin ID not found' });
    }

    // Approve all users
    const result = await db.update(users)
      .set({
        approvalStatus: ApprovalStatus.APPROVED,
        approvedBy: adminId,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(users.approvalStatus, ApprovalStatus.PENDING_APPROVAL),
          eq(users.id, userIds as any) // This will match any of the IDs
        )
      );

    logger.info({ 
      adminId, 
      userIds,
      count: userIds.length 
    }, 'Admin bulk approved users');

    res.json({ 
      message: `Approved ${userIds.length} users`,
      count: userIds.length
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid request data', 
        errors: error.errors 
      });
    }
    
    logger.error({ error, adminId: req.user?.id }, 'Failed to bulk approve users');
    res.status(500).json({ message: 'Failed to bulk approve users' });
  }
});

export default router;
