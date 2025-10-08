import { db } from '../db';
import { emailMessages, emailThreads, emailAccounts } from '@shared/schema';
import { and, or, like, eq, desc, sql, inArray } from 'drizzle-orm';

export interface EmailSearchOptions {
  query?: string;
  fromEmail?: string;
  toEmail?: string;
  subject?: string;
  dateFrom?: Date;
  dateTo?: Date;
  hasAttachments?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  accountIds?: string[];
  labels?: string[];
  limit?: number;
  offset?: number;
}

export interface EmailSearchResult {
  messages: any[];
  totalCount: number;
  searchTime: number;
  suggestions?: string[];
}

export class EmailSearchService {
  /**
   * Advanced email search with multiple filters
   */
  static async searchEmails(
    userId: string,
    options: EmailSearchOptions
  ): Promise<EmailSearchResult> {
    const startTime = Date.now();
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    try {
      // Build search conditions
      const conditions = [
        eq(emailMessages.createdBy, userId)
      ];

      // Text search across multiple fields
      if (options.query) {
        const searchTerm = `%${options.query}%`;
        // For now, search only in subject and from email
        conditions.push(
          or(
            like(emailMessages.subject, searchTerm),
            like(emailMessages.fromEmail, searchTerm)
          )!
        );
      }

      // Specific field filters
      if (options.fromEmail) {
        conditions.push(like(emailMessages.fromEmail, `%${options.fromEmail}%`));
      }

      if (options.subject) {
        conditions.push(like(emailMessages.subject, `%${options.subject}%`));
      }

      // Date range filter
      if (options.dateFrom) {
        conditions.push(sql`${emailMessages.sentAt} >= ${options.dateFrom}`);
      }
      if (options.dateTo) {
        conditions.push(sql`${emailMessages.sentAt} <= ${options.dateTo}`);
      }

      // Boolean filters
      if (options.isRead !== undefined) {
        conditions.push(eq(emailMessages.isRead, options.isRead));
      }
      if (options.isStarred !== undefined) {
        conditions.push(eq(emailMessages.isStarred, options.isStarred));
      }

      // Account filter
      if (options.accountIds && options.accountIds.length > 0) {
        conditions.push(inArray(emailMessages.emailAccountId, options.accountIds));
      }

      // Attachment filter
      if (options.hasAttachments !== undefined) {
        if (options.hasAttachments) {
          conditions.push(sql`EXISTS (
            SELECT 1 FROM email_attachments 
            WHERE email_attachments.message_id = ${emailMessages.id}
          )`);
        } else {
          conditions.push(sql`NOT EXISTS (
            SELECT 1 FROM email_attachments 
            WHERE email_attachments.message_id = ${emailMessages.id}
          )`);
        }
      }

      // Execute search query
      const messages = await db
        .select({
          id: emailMessages.id,
          threadId: emailMessages.threadId,
          subject: emailMessages.subject,
          fromEmail: emailMessages.fromEmail,
          toEmails: emailMessages.toEmails,
          sentAt: emailMessages.sentAt,
          isRead: emailMessages.isRead,
          isStarred: emailMessages.isStarred,
          messageType: emailMessages.messageType,
          // Include snippet for search results
          textSnippet: sql<string>`
            CASE 
              WHEN LENGTH(${emailMessages.textBody}) > 200 
              THEN SUBSTRING(${emailMessages.textBody}, 1, 200) || '...'
              ELSE ${emailMessages.textBody}
            END
          `,
          accountName: emailAccounts.accountName,
          accountEmail: emailAccounts.emailAddress
        })
        .from(emailMessages)
        .leftJoin(emailAccounts, eq(emailMessages.emailAccountId, emailAccounts.id))
        .where(and(...conditions))
        .orderBy(desc(emailMessages.sentAt))
        .limit(limit)
        .offset(offset);

      // Get total count for pagination
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(emailMessages)
        .leftJoin(emailAccounts, eq(emailMessages.emailAccountId, emailAccounts.id))
        .where(and(...conditions));

      const searchTime = Date.now() - startTime;

      // Generate search suggestions if no results
      let suggestions: string[] = [];
      if (messages.length === 0 && options.query) {
        suggestions = await this.generateSearchSuggestions(userId, options.query);
      }

      return {
        messages,
        totalCount: count,
        searchTime,
        suggestions
      };

    } catch (error) {
      console.error('Email search error:', error);
      throw new Error('Search failed');
    }
  }

  /**
   * Generate search suggestions based on user's email data
   */
  private static async generateSearchSuggestions(
    userId: string,
    query: string
  ): Promise<string[]> {
    try {
      // Get common senders
      const commonSenders = await db
        .select({
          fromEmail: emailMessages.fromEmail,
          count: sql<number>`count(*)`
        })
        .from(emailMessages)
        .where(eq(emailMessages.createdBy, userId))
        .groupBy(emailMessages.fromEmail)
        .orderBy(desc(sql`count(*)`))
        .limit(5);

      // Get common subjects
      const commonSubjects = await db
        .select({
          subject: emailMessages.subject,
          count: sql<number>`count(*)`
        })
        .from(emailMessages)
        .where(eq(emailMessages.createdBy, userId))
        .groupBy(emailMessages.subject)
        .orderBy(desc(sql`count(*)`))
        .limit(5);

      const suggestions: string[] = [];

      // Add sender suggestions
      commonSenders.forEach(sender => {
        if (sender.fromEmail.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push(`from:${sender.fromEmail}`);
        }
      });

      // Add subject suggestions
      commonSubjects.forEach(subject => {
        if (subject.subject.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push(`subject:"${subject.subject}"`);
        }
      });

      return suggestions.slice(0, 3);
    } catch (error) {
      console.error('Error generating search suggestions:', error);
      return [];
    }
  }

  /**
   * Get search analytics for user
   */
  static async getSearchAnalytics(userId: string): Promise<{
    topSenders: Array<{ email: string; count: number }>;
    emailsByMonth: Array<{ month: string; count: number }>;
    readVsUnread: { read: number; unread: number };
  }> {
    try {
      // Top senders
      const topSenders = await db
        .select({
          email: emailMessages.fromEmail,
          count: sql<number>`count(*)`
        })
        .from(emailMessages)
        .where(eq(emailMessages.createdBy, userId))
        .groupBy(emailMessages.fromEmail)
        .orderBy(desc(sql`count(*)`))
        .limit(10);

      // Emails by month
      const emailsByMonth = await db
        .select({
          month: sql<string>`to_char(${emailMessages.sentAt}, 'YYYY-MM')`,
          count: sql<number>`count(*)`
        })
        .from(emailMessages)
        .where(eq(emailMessages.createdBy, userId))
        .groupBy(sql`to_char(${emailMessages.sentAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${emailMessages.sentAt}, 'YYYY-MM')`)
        .limit(12);

      // Read vs unread
      const [readStats] = await db
        .select({
          read: sql<number>`count(*) filter (where ${emailMessages.isRead} = true)`,
          unread: sql<number>`count(*) filter (where ${emailMessages.isRead} = false)`
        })
        .from(emailMessages)
        .where(eq(emailMessages.createdBy, userId));

      return {
        topSenders,
        emailsByMonth,
        readVsUnread: readStats
      };
    } catch (error) {
      console.error('Error getting search analytics:', error);
      throw new Error('Failed to get analytics');
    }
  }
}
