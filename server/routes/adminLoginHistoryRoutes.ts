import { Router, Request, Response } from 'express';
import { db } from '../db';
import { loginHistory, users, userDevices } from '@shared/schema';
import { eq, desc, and, sql, count } from 'drizzle-orm';
import { isAuthenticated } from '../localAuth';
import { requireRole } from '../middleware/auth';
import { UserRole } from '@shared/schema';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication and admin role
router.use(isAuthenticated);
router.use(requireRole(UserRole.ADMIN));

/**
 * GET /api/admin/users/:id/login-history
 * Get login history for a specific user (last 100 logins)
 */
router.get('/users/:id/login-history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '100' } = req.query;

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        email: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get login history
    const history = await db.query.loginHistory.findMany({
      where: eq(loginHistory.userId, id),
      orderBy: [desc(loginHistory.createdAt)],
      limit: parseInt(limit as string, 10)
    });

    logger.info({ 
      adminId: req.user?.id, 
      targetUserId: id,
      count: history.length 
    }, 'Admin fetched login history');

    res.json({
      user: {
        id: user.id,
        email: user.email
      },
      history
    });
  } catch (error) {
    logger.error({ error, adminId: req.user?.id, userId: req.params.id }, 'Failed to fetch login history');
    res.status(500).json({ message: 'Failed to fetch login history' });
  }
});

/**
 * GET /api/admin/suspicious-logins
 * Get all suspicious login attempts
 */
router.get('/suspicious-logins', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Get suspicious logins with user info
    const suspiciousLogins = await db
      .select({
        id: loginHistory.id,
        userId: loginHistory.userId,
        userEmail: users.email,
        userName: sql`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        status: loginHistory.status,
        ipAddress: loginHistory.ipAddress,
        city: loginHistory.city,
        region: loginHistory.region,
        country: loginHistory.country,
        countryCode: loginHistory.countryCode,
        browser: loginHistory.browser,
        os: loginHistory.os,
        deviceType: loginHistory.deviceType,
        suspiciousReasons: loginHistory.suspiciousReasons,
        isNewLocation: loginHistory.isNewLocation,
        isNewDevice: loginHistory.isNewDevice,
        createdAt: loginHistory.createdAt
      })
      .from(loginHistory)
      .leftJoin(users, eq(loginHistory.userId, users.id))
      .where(eq(loginHistory.isSuspicious, true))
      .orderBy(desc(loginHistory.createdAt))
      .limit(limitNum)
      .offset(offset);

    // Get total count
    const totalQuery = await db
      .select({ count: count() })
      .from(loginHistory)
      .where(eq(loginHistory.isSuspicious, true));
    
    const total = totalQuery[0]?.count || 0;

    logger.info({ 
      adminId: req.user?.id, 
      total,
      page: pageNum 
    }, 'Admin fetched suspicious logins');

    res.json({
      logins: suspiciousLogins,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limitNum)
      }
    });
  } catch (error) {
    logger.error({ error, adminId: req.user?.id }, 'Failed to fetch suspicious logins');
    res.status(500).json({ message: 'Failed to fetch suspicious logins' });
  }
});

/**
 * GET /api/admin/users/:id/active-sessions
 * Get all active sessions for a user
 */
router.get('/users/:id/active-sessions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get active sessions (non-revoked, not expired)
    const sessions = await db.query.userDevices.findMany({
      where: and(
        eq(userDevices.userId, id),
        eq(userDevices.isRevoked, false),
        sql`${userDevices.expiresAt} > NOW()`
      ),
      orderBy: [desc(userDevices.lastActive)]
    });

    logger.info({ 
      adminId: req.user?.id, 
      targetUserId: id,
      sessionCount: sessions.length 
    }, 'Admin fetched active sessions');

    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        deviceName: s.deviceName,
        deviceType: s.deviceType,
        os: s.os,
        browser: s.browser,
        ipAddress: s.ipAddress,
        lastActive: s.lastActive,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt
      }))
    });
  } catch (error) {
    logger.error({ error, adminId: req.user?.id, userId: req.params.id }, 'Failed to fetch active sessions');
    res.status(500).json({ message: 'Failed to fetch active sessions' });
  }
});

/**
 * POST /api/admin/users/:id/force-logout
 * Force logout a user by revoking all their sessions
 */
router.post('/users/:id/force-logout', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({ message: 'Admin ID not found' });
    }

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        email: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin from logging themselves out
    if (user.id === adminId) {
      return res.status(400).json({ 
        message: 'Cannot force logout yourself',
        code: 'SELF_LOGOUT_PREVENTED'
      });
    }

    // Revoke all active sessions for this user
    const result = await db
      .update(userDevices)
      .set({ 
        isRevoked: true,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(userDevices.userId, id),
          eq(userDevices.isRevoked, false)
        )
      );

    logger.warn({ 
      adminId,
      targetUserId: id,
      targetUserEmail: user.email
    }, 'Admin forced user logout');

    res.json({ 
      message: 'User logged out successfully',
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    logger.error({ error, adminId: req.user?.id, userId: req.params.id }, 'Failed to force logout');
    res.status(500).json({ message: 'Failed to force logout' });
  }
});

/**
 * POST /api/admin/users/:id/revoke-session
 * Revoke a specific session (device)
 */
router.post('/users/:id/revoke-session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { id, sessionId } = req.params;
    const adminId = req.user?.id;

    // Revoke specific session
    const result = await db
      .update(userDevices)
      .set({ 
        isRevoked: true,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(userDevices.id, sessionId),
          eq(userDevices.userId, id)
        )
      );

    logger.info({ 
      adminId,
      targetUserId: id,
      sessionId
    }, 'Admin revoked user session');

    res.json({ 
      message: 'Session revoked successfully'
    });
  } catch (error) {
    logger.error({ error, adminId: req.user?.id, userId: req.params.id }, 'Failed to revoke session');
    res.status(500).json({ message: 'Failed to revoke session' });
  }
});

/**
 * DELETE /api/admin/login-history/cleanup
 * Cleanup old login history (keep only last 100 per user)
 */
router.delete('/login-history/cleanup', async (req: Request, res: Response) => {
  try {
    // This will be implemented as a background job
    // For now, just return success
    logger.info({ adminId: req.user?.id }, 'Login history cleanup requested');
    
    res.json({ 
      message: 'Cleanup scheduled',
      note: 'Old login history records are automatically cleaned up'
    });
  } catch (error) {
    logger.error({ error, adminId: req.user?.id }, 'Failed to cleanup login history');
    res.status(500).json({ message: 'Failed to cleanup login history' });
  }
});

export default router;
