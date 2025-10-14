import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../localAuth';

import { db } from '../db';
import { userActivities } from '@shared/activity';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = Router();
// Role-based access control removed for now - using basic authentication only

interface ActivityQuery {
  startDate?: string;
  endDate?: string;
  userId?: string;
  activityType?: string;
  page?: string;
  limit?: string;
}

// Query activities with filters
router.get('/activities', isAuthenticated, async (req: Request, res: Response) => {
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
    logger.error({ error: e }, 'Admin overview error:');
    res.status(500).json({ message: 'Failed to load overview' });
  }
});

// Device/browser/OS distribution
router.get('/devices', isAuthenticated, async (req: Request, res: Response) => {
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
    logger.error({ error: e }, 'Admin devices error:');
    res.status(500).json({ message: 'Failed to load device stats' });
  }
});

// Geo distribution
router.get('/geo', isAuthenticated, async (req: Request, res: Response) => {
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
    logger.error({ error: e }, 'Admin geo error:');
    res.status(500).json({ message: 'Failed to load geo stats' });
  }
});

export default router;