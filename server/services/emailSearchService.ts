import { db } from '../db';
import { emailMessages, emailThreads, emailAccounts, emailAttachments } from '@shared/schema';
import { and, or, like, eq, desc, sql, inArray, gte, lte, not } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { EmailCacheService } from './emailCacheService';

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
  parsedQuery?: ParsedSearchQuery;
}

export interface ParsedSearchQuery {
  from?: string[];
  to?: string[];
  subject?: string[];
  cc?: string[];
  bcc?: string[];
  has?: string[];
  is?: string[];
  in?: string[];
  label?: string[];
  filename?: string[];
  before?: Date;
  after?: Date;
  older_than?: string;
  newer_than?: string;
  larger?: number;
  smaller?: number;
  textSearch?: string[];
  negations?: {
    from?: string[];
    to?: string[];
    subject?: string[];
    has?: string[];
    is?: string[];
  };
}

export class EmailSearchService {
  /**
   * Parse Gmail-style search query
   * Supports: from:, to:, subject:, has:attachment, is:unread, is:starred, 
   *           before:, after:, older_than:, newer_than:, filename:, larger:, smaller:
   * 
   * Examples:
   *   "from:john@example.com subject:meeting"
   *   "has:attachment is:unread after:2024-01-01"
   *   "from:boss -subject:spam larger:10M"
   *   "newer_than:7d is:starred"
   */
  static parseSearchQuery(query: string): ParsedSearchQuery {
    const parsed: ParsedSearchQuery = {
      textSearch: [],
      negations: {}
    };

    // Regular expressions for different operators
    const patterns = {
      from: /(?:^|\s)(-?)from:([^\s]+)/gi,
      to: /(?:^|\s)(-?)to:([^\s]+)/gi,
      subject: /(?:^|\s)(-?)subject:"([^"]+)"|(?:^|\s)(-?)subject:([^\s]+)/gi,
      cc: /(?:^|\s)cc:([^\s]+)/gi,
      bcc: /(?:^|\s)bcc:([^\s]+)/gi,
      has: /(?:^|\s)(-?)has:([^\s]+)/gi,
      is: /(?:^|\s)(-?)is:([^\s]+)/gi,
      in: /(?:^|\s)in:([^\s]+)/gi,
      label: /(?:^|\s)label:([^\s]+)/gi,
      filename: /(?:^|\s)filename:"([^"]+)"|(?:^|\s)filename:([^\s]+)/gi,
      before: /(?:^|\s)before:(\d{4}[-/]\d{1,2}[-/]\d{1,2})/gi,
      after: /(?:^|\s)after:(\d{4}[-/]\d{1,2}[-/]\d{1,2})/gi,
      older_than: /(?:^|\s)older_than:(\d+[dmy])/gi,
      newer_than: /(?:^|\s)newer_than:(\d+[dmy])/gi,
      larger: /(?:^|\s)larger:(\d+[KMG]?)/gi,
      smaller: /(?:^|\s)smaller:(\d+[KMG]?)/gi,
    };

    let remainingQuery = query;

    // Parse from: operator
    let match;
    while ((match = patterns.from.exec(query)) !== null) {
      const isNegation = match[1] === '-';
      const value = match[2];
      if (isNegation) {
        parsed.negations.from = parsed.negations.from || [];
        parsed.negations.from.push(value);
      } else {
        parsed.from = parsed.from || [];
        parsed.from.push(value);
      }
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse to: operator
    patterns.to.lastIndex = 0;
    while ((match = patterns.to.exec(query)) !== null) {
      const isNegation = match[1] === '-';
      const value = match[2];
      if (isNegation) {
        parsed.negations.to = parsed.negations.to || [];
        parsed.negations.to.push(value);
      } else {
        parsed.to = parsed.to || [];
        parsed.to.push(value);
      }
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse subject: operator
    patterns.subject.lastIndex = 0;
    while ((match = patterns.subject.exec(query)) !== null) {
      const isNegation = match[1] === '-' || match[3] === '-';
      const value = match[2] || match[4];
      if (isNegation) {
        parsed.negations.subject = parsed.negations.subject || [];
        parsed.negations.subject.push(value);
      } else {
        parsed.subject = parsed.subject || [];
        parsed.subject.push(value);
      }
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse has: operator (attachment, drive, document, spreadsheet, presentation, pdf)
    patterns.has.lastIndex = 0;
    while ((match = patterns.has.exec(query)) !== null) {
      const isNegation = match[1] === '-';
      const value = match[2];
      if (isNegation) {
        parsed.negations.has = parsed.negations.has || [];
        parsed.negations.has.push(value);
      } else {
        parsed.has = parsed.has || [];
        parsed.has.push(value);
      }
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse is: operator (read, unread, starred, important)
    patterns.is.lastIndex = 0;
    while ((match = patterns.is.exec(query)) !== null) {
      const isNegation = match[1] === '-';
      const value = match[2];
      if (isNegation) {
        parsed.negations.is = parsed.negations.is || [];
        parsed.negations.is.push(value);
      } else {
        parsed.is = parsed.is || [];
        parsed.is.push(value);
      }
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse in: operator (inbox, sent, drafts, trash, spam)
    patterns.in.lastIndex = 0;
    while ((match = patterns.in.exec(query)) !== null) {
      parsed.in = parsed.in || [];
      parsed.in.push(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse label: operator
    patterns.label.lastIndex = 0;
    while ((match = patterns.label.exec(query)) !== null) {
      parsed.label = parsed.label || [];
      parsed.label.push(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse filename: operator
    patterns.filename.lastIndex = 0;
    while ((match = patterns.filename.exec(query)) !== null) {
      parsed.filename = parsed.filename || [];
      parsed.filename.push(match[1] || match[2]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse before: operator
    patterns.before.lastIndex = 0;
    if ((match = patterns.before.exec(query)) !== null) {
      parsed.before = new Date(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse after: operator
    patterns.after.lastIndex = 0;
    if ((match = patterns.after.exec(query)) !== null) {
      parsed.after = new Date(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse older_than: operator (1d, 2m, 1y)
    patterns.older_than.lastIndex = 0;
    if ((match = patterns.older_than.exec(query)) !== null) {
      parsed.older_than = match[1];
      parsed.before = this.parseRelativeDate(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse newer_than: operator
    patterns.newer_than.lastIndex = 0;
    if ((match = patterns.newer_than.exec(query)) !== null) {
      parsed.newer_than = match[1];
      parsed.after = this.parseRelativeDate(match[1], true);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse larger: operator (bytes, K=kilobytes, M=megabytes, G=gigabytes)
    patterns.larger.lastIndex = 0;
    if ((match = patterns.larger.exec(query)) !== null) {
      parsed.larger = this.parseFileSize(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Parse smaller: operator
    patterns.smaller.lastIndex = 0;
    if ((match = patterns.smaller.exec(query)) !== null) {
      parsed.smaller = this.parseFileSize(match[1]);
      remainingQuery = remainingQuery.replace(match[0], '');
    }

    // Everything else is text search
    const cleanedText = remainingQuery.trim();
    if (cleanedText) {
      // Split by quoted strings and regular words
      const quotedPattern = /"([^"]+)"/g;
      const quoted: string[] = [];
      let quotedMatch;
      while ((quotedMatch = quotedPattern.exec(cleanedText)) !== null) {
        quoted.push(quotedMatch[1]);
      }
      
      const withoutQuotes = cleanedText.replace(quotedPattern, '').trim();
      const words = withoutQuotes.split(/\s+/).filter(w => w.length > 0);
      
      parsed.textSearch = [...quoted, ...words];
    }

    return parsed;
  }

  /**
   * Parse relative date (1d, 2m, 1y)
   */
  private static parseRelativeDate(relative: string, isAfter = false): Date {
    const match = relative.match(/(\d+)([dmy])/);
    if (!match) return new Date();

    const amount = parseInt(match[1]);
    const unit = match[2];
    const date = new Date();

    switch (unit) {
      case 'd':
        date.setDate(date.getDate() - (isAfter ? -amount : amount));
        break;
      case 'm':
        date.setMonth(date.getMonth() - (isAfter ? -amount : amount));
        break;
      case 'y':
        date.setFullYear(date.getFullYear() - (isAfter ? -amount : amount));
        break;
    }

    return date;
  }

  /**
   * Parse file size (10K, 5M, 1G)
   */
  private static parseFileSize(size: string): number {
    const match = size.match(/(\d+)([KMG]?)/);
    if (!match) return 0;

    const amount = parseInt(match[1]);
    const unit = match[2] || '';

    switch (unit) {
      case 'K': return amount * 1024;
      case 'M': return amount * 1024 * 1024;
      case 'G': return amount * 1024 * 1024 * 1024;
      default: return amount;
    }
  }

  /**
   * Advanced email search with Gmail-style operators
   */
  static async searchEmails(
    userId: string,
    options: EmailSearchOptions
  ): Promise<EmailSearchResult> {
    const startTime = Date.now();
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    try {
      // Check cache first
      const cacheKey = `search-${userId}-${options.query}-${offset}`;
      if (options.query && offset === 0) {
        const cached = await EmailCacheService.getThreadList(userId, cacheKey);
        if (cached) {
          logger.debug(`📊 Cache hit for search: ${options.query}`);
          return {
            messages: cached,
            totalCount: cached.length,
            searchTime: Date.now() - startTime,
            suggestions: []
          };
        }
      }

      // Parse Gmail-style query
      let parsed: ParsedSearchQuery | undefined;
      if (options.query) {
        parsed = this.parseSearchQuery(options.query);
        logger.debug('Parsed search query:', parsed);
      }

      // Build search conditions
      const conditions = [
        eq(emailMessages.createdBy, userId)
      ];

      // Apply parsed query conditions
      if (parsed) {
        // FROM conditions
        if (parsed.from && parsed.from.length > 0) {
          const fromConditions = parsed.from.map(email =>
            like(emailMessages.fromEmail, `%${email}%`)
          );
          conditions.push(or(...fromConditions)!);
        }
        if (parsed.negations?.from && parsed.negations.from.length > 0) {
          parsed.negations.from.forEach(email => {
            conditions.push(not(like(emailMessages.fromEmail, `%${email}%`)));
          });
        }

        // TO conditions
        if (parsed.to && parsed.to.length > 0) {
          const toConditions = parsed.to.map(email =>
            sql`${emailMessages.toEmails}::text LIKE ${`%${email}%`}`
          );
          conditions.push(or(...toConditions)!);
        }
        if (parsed.negations?.to && parsed.negations.to.length > 0) {
          parsed.negations.to.forEach(email => {
            conditions.push(sql`NOT (${emailMessages.toEmails}::text LIKE ${`%${email}%`})`);
          });
        }

        // SUBJECT conditions
        if (parsed.subject && parsed.subject.length > 0) {
          const subjectConditions = parsed.subject.map(subj =>
            like(emailMessages.subject, `%${subj}%`)
          );
          conditions.push(or(...subjectConditions)!);
        }
        if (parsed.negations?.subject && parsed.negations.subject.length > 0) {
          parsed.negations.subject.forEach(subj => {
            conditions.push(not(like(emailMessages.subject, `%${subj}%`)));
          });
        }

        // HAS conditions (attachments, etc)
        if (parsed.has && parsed.has.length > 0) {
          parsed.has.forEach(hasType => {
            if (hasType === 'attachment') {
              conditions.push(sql`EXISTS (
                SELECT 1 FROM email_attachments 
                WHERE email_attachments.message_id = ${emailMessages.id}
              )`);
            }
          });
        }
        if (parsed.negations?.has && parsed.negations.has.length > 0) {
          parsed.negations.has.forEach(hasType => {
            if (hasType === 'attachment') {
              conditions.push(sql`NOT EXISTS (
                SELECT 1 FROM email_attachments 
                WHERE email_attachments.message_id = ${emailMessages.id}
              )`);
            }
          });
        }

        // IS conditions (read, unread, starred)
        if (parsed.is && parsed.is.length > 0) {
          parsed.is.forEach(isType => {
            if (isType === 'read') {
              conditions.push(eq(emailMessages.isRead, true));
            } else if (isType === 'unread') {
              conditions.push(eq(emailMessages.isRead, false));
            } else if (isType === 'starred' || isType === 'star') {
              conditions.push(eq(emailMessages.isStarred, true));
            } else if (isType === 'important') {
              conditions.push(eq(emailMessages.isImportant, true));
            }
          });
        }
        if (parsed.negations?.is && parsed.negations.is.length > 0) {
          parsed.negations.is.forEach(isType => {
            if (isType === 'read') {
              conditions.push(eq(emailMessages.isRead, false));
            } else if (isType === 'unread') {
              conditions.push(eq(emailMessages.isRead, true));
            } else if (isType === 'starred' || isType === 'star') {
              conditions.push(eq(emailMessages.isStarred, false));
            }
          });
        }

        // Date conditions
        if (parsed.before) {
          conditions.push(lte(emailMessages.sentAt, parsed.before));
        }
        if (parsed.after) {
          conditions.push(gte(emailMessages.sentAt, parsed.after));
        }

        // Filename search
        if (parsed.filename && parsed.filename.length > 0) {
          const filenameConditions = parsed.filename.map(name =>
            sql`EXISTS (
              SELECT 1 FROM email_attachments 
              WHERE email_attachments.message_id = ${emailMessages.id}
              AND email_attachments.file_name LIKE ${`%${name}%`}
            )`
          );
          conditions.push(or(...filenameConditions)!);
        }

        // File size conditions
        if (parsed.larger) {
          conditions.push(sql`EXISTS (
            SELECT 1 FROM email_attachments 
            WHERE email_attachments.message_id = ${emailMessages.id}
            AND email_attachments.file_size > ${parsed.larger}
          )`);
        }
        if (parsed.smaller) {
          conditions.push(sql`EXISTS (
            SELECT 1 FROM email_attachments 
            WHERE email_attachments.message_id = ${emailMessages.id}
            AND email_attachments.file_size < ${parsed.smaller}
          )`);
        }

        // Full-text search in body
        if (parsed.textSearch && parsed.textSearch.length > 0) {
          const textConditions = parsed.textSearch.map(text => 
            or(
              like(emailMessages.subject, `%${text}%`),
              like(emailMessages.textBody, `%${text}%`),
              like(emailMessages.htmlBody, `%${text}%`),
              like(emailMessages.fromEmail, `%${text}%`)
            )!
          );
          conditions.push(and(...textConditions)!);
        }
      }

      // Legacy options support
      if (options.fromEmail) {
        conditions.push(like(emailMessages.fromEmail, `%${options.fromEmail}%`));
      }
      if (options.subject) {
        conditions.push(like(emailMessages.subject, `%${options.subject}%`));
      }
      if (options.dateFrom) {
        conditions.push(gte(emailMessages.sentAt, options.dateFrom));
      }
      if (options.dateTo) {
        conditions.push(lte(emailMessages.sentAt, options.dateTo));
      }
      if (options.isRead !== undefined) {
        conditions.push(eq(emailMessages.isRead, options.isRead));
      }
      if (options.isStarred !== undefined) {
        conditions.push(eq(emailMessages.isStarred, options.isStarred));
      }
      if (options.accountIds && options.accountIds.length > 0) {
        conditions.push(inArray(emailMessages.emailAccountId, options.accountIds));
      }
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

      // Execute search query with LEFT JOIN for attachments info
      const messages = await db
        .select({
          id: emailMessages.id,
          threadId: emailMessages.threadId,
          subject: emailMessages.subject,
          fromEmail: emailMessages.fromEmail,
          toEmails: emailMessages.toEmails,
          ccEmails: emailMessages.ccEmails,
          sentAt: emailMessages.sentAt,
          isRead: emailMessages.isRead,
          isStarred: emailMessages.isStarred,
          isImportant: emailMessages.isImportant,
          messageType: emailMessages.messageType,
          textSnippet: sql<string>`
            CASE 
              WHEN LENGTH(${emailMessages.textBody}) > 200 
              THEN SUBSTRING(${emailMessages.textBody}, 1, 200) || '...'
              ELSE ${emailMessages.textBody}
            END
          `,
          accountName: emailAccounts.accountName,
          accountEmail: emailAccounts.emailAddress,
          hasAttachments: sql<boolean>`EXISTS (
            SELECT 1 FROM email_attachments 
            WHERE email_attachments.message_id = ${emailMessages.id}
          )`,
          attachmentCount: sql<number>`(
            SELECT COUNT(*) FROM email_attachments 
            WHERE email_attachments.message_id = ${emailMessages.id}
          )`
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

      // Cache results
      if (options.query && offset === 0) {
        await EmailCacheService.cacheThreadList(userId, cacheKey, messages, { ttl: 60 });
      }

      // Generate search suggestions if no results
      let suggestions: string[] = [];
      if (messages.length === 0 && options.query) {
        suggestions = await this.generateSearchSuggestions(userId, options.query);
      }

      logger.info(`🔍 Search completed: "${options.query}" - ${messages.length} results in ${searchTime}ms`);

      return {
        messages,
        totalCount: count,
        searchTime,
        suggestions,
        parsedQuery: parsed
      };

    } catch (error) {
      logger.error({ error: error }, 'Email search error:');
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

      // Add common search operators as suggestions
      if (!query.includes(':')) {
        suggestions.push(`from:${query}`, `subject:${query}`, `${query} has:attachment`);
      }

      return suggestions.slice(0, 5);
    } catch (error) {
      logger.error({ error: error }, 'Error generating search suggestions:');
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
      logger.error({ error: error }, 'Error getting search analytics:');
      throw new Error('Failed to get analytics');
    }
  }

  /**
   * Get search operator suggestions
   */
  static getSearchOperatorHelp(): {
    category: string;
    operators: Array<{ operator: string; description: string; example: string }>;
  }[] {
    return [
      {
        category: 'From/To/Subject',
        operators: [
          { operator: 'from:', description: 'Search for emails from a specific sender', example: 'from:john@example.com' },
          { operator: 'to:', description: 'Search for emails sent to someone', example: 'to:jane@example.com' },
          { operator: 'subject:', description: 'Search in subject line', example: 'subject:meeting' },
          { operator: 'cc:', description: 'Search for emails CC\'d to someone', example: 'cc:team@example.com' },
        ]
      },
      {
        category: 'Status',
        operators: [
          { operator: 'is:read', description: 'Search read emails', example: 'is:read from:boss' },
          { operator: 'is:unread', description: 'Search unread emails', example: 'is:unread' },
          { operator: 'is:starred', description: 'Search starred emails', example: 'is:starred' },
          { operator: 'is:important', description: 'Search important emails', example: 'is:important' },
        ]
      },
      {
        category: 'Attachments',
        operators: [
          { operator: 'has:attachment', description: 'Search emails with attachments', example: 'has:attachment from:client' },
          { operator: 'filename:', description: 'Search by attachment name', example: 'filename:report.pdf' },
          { operator: 'larger:', description: 'Emails with attachments larger than size', example: 'larger:10M' },
          { operator: 'smaller:', description: 'Emails with attachments smaller than size', example: 'smaller:1M' },
        ]
      },
      {
        category: 'Date',
        operators: [
          { operator: 'after:', description: 'Search emails after a date', example: 'after:2024-01-01' },
          { operator: 'before:', description: 'Search emails before a date', example: 'before:2024-12-31' },
          { operator: 'newer_than:', description: 'Newer than time period', example: 'newer_than:7d' },
          { operator: 'older_than:', description: 'Older than time period', example: 'older_than:1m' },
        ]
      },
      {
        category: 'Negation',
        operators: [
          { operator: '-from:', description: 'Exclude sender', example: '-from:spam@example.com' },
          { operator: '-subject:', description: 'Exclude subject', example: '-subject:newsletter' },
          { operator: '-has:attachment', description: 'Without attachments', example: '-has:attachment' },
        ]
      }
    ];
  }
}
