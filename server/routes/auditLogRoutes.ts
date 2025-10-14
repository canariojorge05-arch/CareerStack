import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = Router();

// Get audit logs for a specific requirement
router.get('/requirements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const result = await db.execute(sql`
      SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = 'requirement'
        AND al.entity_id = ${id}
      ORDER BY al.created_at DESC
      LIMIT ${Number(limit)}
    `);
    
    res.json(result.rows || []);
  } catch (error) {
    logger.error({ error: error }, 'Failed to fetch audit logs:');
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
});

export default router;