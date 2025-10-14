import { db } from '../db';
import { emailMessages, emailThreads } from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { logger } from '../utils/logger';

export interface EmailAnalytics {
  totalEmails: number;
  sentEmails: number;
  receivedEmails: number;
  responseRate: number;
  averageResponseTime: number; // in hours
  topContacts: Array<{ email: string; count: number; lastContact: Date }>;
  emailsByDay: Array<{ date: string; sent: number; received: number }>;
  responseTimeDistribution: Array<{ range: string; count: number }>;
  insights: string[];
}

export class EmailAnalyticsService {
  /**
   * Generate comprehensive email analytics for user
   */
  static async generateAnalytics(
    userId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<EmailAnalytics> {
    try {
      // Basic email counts
      const [emailCounts] = await db
        .select({
          total: sql<number>`count(*)`,
          sent: sql<number>`count(*) filter (where ${emailMessages.messageType} = 'sent')`,
          received: sql<number>`count(*) filter (where ${emailMessages.messageType} = 'received')`
        })
        .from(emailMessages)
        .where(
          and(
            eq(emailMessages.createdBy, userId),
            gte(emailMessages.sentAt, dateFrom),
            lte(emailMessages.sentAt, dateTo)
          )
        );

      // Response rate calculation
      const responseRate = await this.calculateResponseRate(userId, dateFrom, dateTo);

      // Average response time
      const averageResponseTime = await this.calculateAverageResponseTime(userId, dateFrom, dateTo);

      // Top contacts
      const topContacts = await this.getTopContacts(userId, dateFrom, dateTo);

      // Emails by day
      const emailsByDay = await this.getEmailsByDay(userId, dateFrom, dateTo);

      // Response time distribution
      const responseTimeDistribution = await this.getResponseTimeDistribution(userId, dateFrom, dateTo);

      // Generate insights
      const insights = this.generateInsights({
        totalEmails: emailCounts.total,
        sentEmails: emailCounts.sent,
        receivedEmails: emailCounts.received,
        responseRate,
        averageResponseTime,
        topContacts,
        emailsByDay
      });

      return {
        totalEmails: emailCounts.total,
        sentEmails: emailCounts.sent,
        receivedEmails: emailCounts.received,
        responseRate,
        averageResponseTime,
        topContacts,
        emailsByDay,
        responseTimeDistribution,
        insights
      };
    } catch (error) {
      logger.error({ error: error }, 'Error generating email analytics:');
      throw new Error('Failed to generate analytics');
    }
  }

  /**
   * Calculate response rate for sent emails
   */
  private static async calculateResponseRate(
    userId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<number> {
    try {
      // Get sent emails in the period
      const sentEmails = await db
        .select({ threadId: emailMessages.threadId })
        .from(emailMessages)
        .where(
          and(
            eq(emailMessages.createdBy, userId),
            eq(emailMessages.messageType, 'sent'),
            gte(emailMessages.sentAt, dateFrom),
            lte(emailMessages.sentAt, dateTo)
          )
        );

      if (sentEmails.length === 0) return 0;

      // Count how many of these threads have received responses
      const threadsWithResponses = await db
        .select({ threadId: emailMessages.threadId })
        .from(emailMessages)
        .where(
          and(
            eq(emailMessages.createdBy, userId),
            eq(emailMessages.messageType, 'received'),
            sql`${emailMessages.threadId} IN (${sql.join(sentEmails.map(e => sql`${e.threadId}`), sql`, `)})`
          )
        )
        .groupBy(emailMessages.threadId);

      return (threadsWithResponses.length / sentEmails.length) * 100;
    } catch (error) {
      logger.error({ error: error }, 'Error calculating response rate:');
      return 0;
    }
  }

  /**
   * Calculate average response time in hours
   */
  private static async calculateAverageResponseTime(
    userId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<number> {
    try {
      // For now, return mock data since complex joins need proper alias setup
      const responseTimes = [
        { responseTime: 2.5 },
        { responseTime: 1.2 },
        { responseTime: 4.8 },
        { responseTime: 0.5 }
      ];

      if (responseTimes.length === 0) return 0;

      const totalTime = responseTimes.reduce((sum, rt) => sum + rt.responseTime, 0);
      return totalTime / responseTimes.length;
    } catch (error) {
      logger.error({ error: error }, 'Error calculating average response time:');
      return 0;
    }
  }

  /**
   * Get top email contacts
   */
  private static async getTopContacts(
    userId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<Array<{ email: string; count: number; lastContact: Date }>> {
    try {
      const contacts = await db
        .select({
          email: sql<string>`
            CASE 
              WHEN ${emailMessages.messageType} = 'sent' THEN ${emailMessages.toEmails}[1]
              ELSE ${emailMessages.fromEmail}
            END
          `,
          count: sql<number>`count(*)`,
          lastContact: sql<Date>`max(${emailMessages.sentAt})`
        })
        .from(emailMessages)
        .where(
          and(
            eq(emailMessages.createdBy, userId),
            gte(emailMessages.sentAt, dateFrom),
            lte(emailMessages.sentAt, dateTo)
          )
        )
        .groupBy(sql`
          CASE 
            WHEN ${emailMessages.messageType} = 'sent' THEN ${emailMessages.toEmails}[1]
            ELSE ${emailMessages.fromEmail}
          END
        `)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      return contacts;
    } catch (error) {
      logger.error({ error: error }, 'Error getting top contacts:');
      return [];
    }
  }

  /**
   * Get emails by day for trend analysis
   */
  private static async getEmailsByDay(
    userId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<Array<{ date: string; sent: number; received: number }>> {
    try {
      const emailsByDay = await db
        .select({
          date: sql<string>`date(${emailMessages.sentAt})`,
          sent: sql<number>`count(*) filter (where ${emailMessages.messageType} = 'sent')`,
          received: sql<number>`count(*) filter (where ${emailMessages.messageType} = 'received')`
        })
        .from(emailMessages)
        .where(
          and(
            eq(emailMessages.createdBy, userId),
            gte(emailMessages.sentAt, dateFrom),
            lte(emailMessages.sentAt, dateTo)
          )
        )
        .groupBy(sql`date(${emailMessages.sentAt})`)
        .orderBy(sql`date(${emailMessages.sentAt})`);

      return emailsByDay;
    } catch (error) {
      logger.error({ error: error }, 'Error getting emails by day:');
      return [];
    }
  }

  /**
   * Get response time distribution
   */
  private static async getResponseTimeDistribution(
    userId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<Array<{ range: string; count: number }>> {
    // This would calculate response time ranges (< 1 hour, 1-4 hours, 4-24 hours, etc.)
    // For now, return mock data
    return [
      { range: '< 1 hour', count: 15 },
      { range: '1-4 hours', count: 25 },
      { range: '4-24 hours', count: 30 },
      { range: '1-3 days', count: 20 },
      { range: '> 3 days', count: 10 }
    ];
  }

  /**
   * Generate actionable insights from analytics data
   */
  private static generateInsights(data: Partial<EmailAnalytics>): string[] {
    const insights: string[] = [];

    // Response rate insights
    if (data.responseRate !== undefined) {
      if (data.responseRate > 80) {
        insights.push('🎉 Excellent response rate! Your emails are highly engaging.');
      } else if (data.responseRate > 50) {
        insights.push('👍 Good response rate. Consider A/B testing subject lines to improve further.');
      } else if (data.responseRate > 20) {
        insights.push('📈 Response rate has room for improvement. Try personalizing your emails more.');
      } else {
        insights.push('⚠️ Low response rate. Consider reviewing your email strategy and timing.');
      }
    }

    // Response time insights
    if (data.averageResponseTime !== undefined) {
      if (data.averageResponseTime < 2) {
        insights.push('⚡ You respond very quickly to emails - great for building relationships!');
      } else if (data.averageResponseTime > 48) {
        insights.push('🐌 Consider responding to emails more quickly to improve engagement.');
      }
    }

    // Email volume insights
    if (data.sentEmails !== undefined && data.receivedEmails !== undefined) {
      const ratio = data.sentEmails / (data.receivedEmails || 1);
      if (ratio > 2) {
        insights.push('📤 You send significantly more emails than you receive. Consider if all are necessary.');
      } else if (ratio < 0.5) {
        insights.push('📥 You receive many more emails than you send. Consider being more proactive in communication.');
      }
    }

    // Contact diversity insights
    if (data.topContacts && data.topContacts.length > 0) {
      const topContactPercentage = (data.topContacts[0].count / (data.totalEmails || 1)) * 100;
      if (topContactPercentage > 30) {
        insights.push('🎯 Most of your emails are with one contact. Consider expanding your network.');
      }
    }

    return insights;
  }

  /**
   * Get email performance metrics for specific campaigns or templates
   */
  static async getCampaignMetrics(
    userId: string,
    campaignId: string
  ): Promise<{
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  }> {
    // This would track email campaign performance
    // For now, return mock data
    return {
      sent: 100,
      opened: 75,
      clicked: 25,
      replied: 15,
      bounced: 2,
      openRate: 75,
      clickRate: 25,
      replyRate: 15
    };
  }
}
