import { Router, Request, Response } from 'express';
import { isAuthenticated, requireRole } from '../middleware/auth';
import { db } from '../db';
import { userActivities } from '@shared/activity';
import { sql } from 'drizzle-orm';

const router = Router();
const isAdmin = requireRole('admin');

interface ActivityQuery {
  startDate?: string;
  endDate?: string;
  userId?: string;
  activityType?: string;
  page?: string;
  limit?: string;
}

// Query activities with filters
router.get('/activities', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const {
      startDate: startDateStr,
      endDate: endDateStr,
      userId,
      activityType,
      page = '1',
      limit = '20'
    } = req.query as ActivityQuery;
    const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    let query = sql`
      SELECT strftime('%Y-%m-%d', datetime(created_at/1000, 'unixepoch')) AS day, 
             COUNT(*) AS total
      FROM user_activities
      WHERE created_at BETWEEN ${startDate.getTime()} AND ${endDate.getTime()}
    `;

    if (userId) {
      query = sql`${query} AND user_id = ${userId}`;
    }

    if (activityType) {
      query = sql`${query} AND activity_type = ${activityType}`;
    }

    query = sql`${query}
      GROUP BY day
      ORDER BY day
    `;

    const rows = await db.execute(query);

    res.json(rows);
  } catch (e) {
    console.error('Admin overview error:', e);
    res.status(500).json({ message: 'Failed to load overview' });
  }
});

// Device/browser/OS distribution
router.get('/devices', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const {
      startDate: startDateStr,
      endDate: endDateStr,
      userId,
      activityType
    } = req.query as ActivityQuery;

    const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    let baseQuery = sql`
      WHERE created_at BETWEEN ${startDate.getTime()} AND ${endDate.getTime()}
    `;

    if (userId) {
      baseQuery = sql`${baseQuery} AND user_id = ${userId}`;
    }

    if (activityType) {
      baseQuery = sql`${baseQuery} AND activity_type = ${activityType}`;
    }

    const browsers = await db.execute(sql`
      SELECT 
        COALESCE(json_extract(device_info, '$.browser'), 'Unknown') AS label,
        COUNT(*) AS value
      FROM user_activities
      ${baseQuery}
      GROUP BY label
      ORDER BY value DESC
      LIMIT 10
    `);

    const os = await db.execute(sql`
      SELECT 
        COALESCE(json_extract(device_info, '$.os'), 'Unknown') AS label,
        COUNT(*) AS value
      FROM user_activities
      ${baseQuery}
      GROUP BY label
      ORDER BY value DESC
      LIMIT 10
    `);

    res.json({ browsers, os });
  } catch (e) {
    console.error('Admin devices error:', e);
    res.status(500).json({ message: 'Failed to load device stats' });
  }
});

// Geo distribution
router.get('/geo', isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const {
      startDate: startDateStr,
      endDate: endDateStr,
      userId,
      activityType
    } = req.query as ActivityQuery;

    const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    let query = sql`
      SELECT 
        COALESCE(json_extract(geolocation, '$.country'), 'Unknown') AS label,
        COUNT(*) AS value
      FROM user_activities
      WHERE created_at BETWEEN ${startDate.getTime()} AND ${endDate.getTime()}
    `;

    if (userId) {
      query = sql`${query} AND user_id = ${userId}`;
    }

    if (activityType) {
      query = sql`${query} AND activity_type = ${activityType}`;
    }

    query = sql`${query}
      GROUP BY label
      ORDER BY value DESC
      LIMIT 20
    `;

    const countries = await db.execute(query);

    res.json({ countries });
  } catch (e) {
    console.error('Admin geo error:', e);
    res.status(500).json({ message: 'Failed to load geo stats' });
  }
});

export default router;