import { Router } from 'express';
import { db, queryWithTimeout } from '../db';
import { isAuthenticated } from '../localAuth';
import { requirements, interviews, consultants } from '@shared/schema';
import { sql, and, gte, eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = Router();

// Apply authentication
router.use(isAuthenticated);

/**
 * Get dashboard statistics for marketing module
 * Returns real-time counts for requirements, interviews, and consultants
 */
router.get('/marketing/stats', async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Calculate date for "this week" comparison
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Get active requirements count and weekly change
    const [activeRequirementsData] = await queryWithTimeout(
      () => db.select({
        total: sql<number>`COUNT(*)`,
        thisWeek: sql<number>`COUNT(*) FILTER (WHERE created_at >= ${oneWeekAgo})`,
      }).from(requirements).where(
        and(
          sql`status != 'Cancelled'`,
          eq(requirements.createdBy, userId)
        )
      ),
      5000
    );
    
    // Get upcoming interviews (future interviews)
    const now = new Date();
    const [upcomingInterviewsData] = await queryWithTimeout(
      () => db.select({
        total: sql<number>`COUNT(*)`,
        nextInterview: sql<Date>`MIN(interview_date)`,
      }).from(interviews).where(
        and(
          gte(interviews.interviewDate, now),
          eq(interviews.createdBy, userId)
        )
      ),
      5000
    );
    
    // Get active consultants count and monthly change
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const [activeConsultantsData] = await queryWithTimeout(
      () => db.select({
        total: sql<number>`COUNT(*)`,
        thisMonth: sql<number>`COUNT(*) FILTER (WHERE created_at >= ${oneMonthAgo})`,
      }).from(consultants).where(
        and(
          eq(consultants.status, 'Active'),
          eq(consultants.createdBy, userId)
        )
      ),
      5000
    );
    
    // Format next interview date
    let nextInterviewText = 'No upcoming';
    if (upcomingInterviewsData.nextInterview) {
      const nextDate = new Date(upcomingInterviewsData.nextInterview);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const nextDateOnly = new Date(nextDate);
      nextDateOnly.setHours(0, 0, 0, 0);
      
      if (nextDateOnly.getTime() === tomorrow.getTime()) {
        nextInterviewText = 'Tomorrow';
      } else {
        nextInterviewText = nextDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
      }
    }
    
    res.json({
      activeRequirements: {
        total: Number(activeRequirementsData.total || 0),
        weeklyChange: Number(activeRequirementsData.thisWeek || 0),
        trend: Number(activeRequirementsData.thisWeek || 0) > 0 ? 'up' : 'neutral',
      },
      upcomingInterviews: {
        total: Number(upcomingInterviewsData.total || 0),
        nextInterview: nextInterviewText,
      },
      activeConsultants: {
        total: Number(activeConsultantsData.total || 0),
        monthlyChange: Number(activeConsultantsData.thisMonth || 0),
        trend: Number(activeConsultantsData.thisMonth || 0) > 0 ? 'up' : 'neutral',
      },
    });
  } catch (error) {
    logger.error({ error: error }, 'Error fetching marketing stats:');
    res.status(500).json({ 
      message: 'Failed to fetch statistics',
      // Return fallback data so UI doesn't break
      activeRequirements: { total: 0, weeklyChange: 0, trend: 'neutral' },
      upcomingInterviews: { total: 0, nextInterview: 'No upcoming' },
      activeConsultants: { total: 0, monthlyChange: 0, trend: 'neutral' },
    });
  }
});

export default router;
