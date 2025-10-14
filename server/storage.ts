import {
  users,
  resumes,
  techStacks,
  pointGroups,
  processingHistory,
  type User,
  type Resume,
  type UpsertUser,
  type InsertResume,
  type TechStack,
  type InsertTechStack,
  type PointGroup,
  type InsertPointGroup,
  type ProcessingHistory,
  type InsertProcessingHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, inArray, sql, and } from "drizzle-orm";
import memoize from "memoizee";
import { randomUUID } from "crypto";
import { logger } from './utils/logger';

// In-memory cache for super fast operations
const CACHE_TTL = 5000; // 5 seconds cache

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(email: string, password: string): Promise<User>;
  updateUserPassword(id: string, hashedPassword: string): Promise<void>;
  updateUserLastLogin(id: string): Promise<void>;
  
  // Resume operations
  createResume(resume: InsertResume): Promise<Resume>;
  getResumesByUserId(userId: string): Promise<Resume[]>;
  getResumeById(id: string): Promise<Resume | undefined>;
  updateResumeStatus(id: string, status: string): Promise<void>;
  updateResumeContent(id: string, content: string): Promise<void>;
  deleteResume(id: string): Promise<void>;
  
  // Tech stack operations
  createTechStack(techStack: InsertTechStack): Promise<TechStack>;
  createTechStacksBatch(techStacksData: InsertTechStack[]): Promise<TechStack[]>;
  getTechStacksByResumeId(resumeId: string): Promise<TechStack[]>;
  deleteTechStacksByResumeId(resumeId: string): Promise<void>;
  
  // Point group operations
  createPointGroup(pointGroup: InsertPointGroup): Promise<PointGroup>;
  createPointGroupsBatch(pointGroupsData: InsertPointGroup[]): Promise<PointGroup[]>;
  getPointGroupsByResumeId(resumeId: string): Promise<PointGroup[]>;
  deletePointGroupsByResumeId(resumeId: string): Promise<void>;
  
  // Processing history operations
  createProcessingHistory(history: InsertProcessingHistory): Promise<ProcessingHistory>;
  getProcessingHistoryByResumeId(resumeId: string): Promise<ProcessingHistory[]>;
  
  // Stats operations
  getUserStats(userId: string): Promise<{ totalResumes: number; customizations: number; downloads: number }>;
}

export class DatabaseStorage implements IStorage {
  // Cached user operations for lightning speed
  private _getUserCached = memoize(async (id: string): Promise<User | undefined> => {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }, { maxAge: CACHE_TTL, promise: true });

  async getUser(id: string): Promise<User | undefined> {
    return this._getUserCached(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUser(email: string, hashedPassword: string): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        email,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, id));
    // Invalidate user cache
    this._getUserCached.delete(id);
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
    // Invalidate user cache
    this._getUserCached.delete(id);
  }

  // Cache invalidation helpers
  private invalidateUserCache(userId: string) {
    this._getResumesByUserIdCached.delete(userId);
    this._getUserStatsCached.delete(userId);
  }

  // Resume operations with cache invalidation
  async createResume(resume: InsertResume): Promise<Resume> {
    const [newResume] = await db.insert(resumes).values(resume).returning();
    // Invalidate cache immediately for consistency
    this.invalidateUserCache(resume.userId);
    // Normalize customizedContent null -> undefined for consumers
    return {
      ...newResume,
      customizedContent: newResume.customizedContent === null ? undefined : newResume.customizedContent,
    } as Resume;
  }

  // Cached resume fetching with aggressive caching
  private _getResumesByUserIdCached = memoize(async (userId: string): Promise<Resume[]> => {
    const results = await db
      .select()
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .orderBy(desc(resumes.uploadedAt));
    // Normalize DB nulls to undefined so callers always receive consistent resume objects
    return results.map((r: any) => ({
      ...r,
      customizedContent: r.customizedContent === null ? undefined : r.customizedContent,
    }));
  }, { maxAge: CACHE_TTL, promise: true });

  async getResumesByUserId(userId: string): Promise<Resume[]> {
    try {
      return await this._getResumesByUserIdCached(userId);
    } catch (error) {
      logger.error({ error: error }, 'Storage: Error fetching resumes:');
      throw error;
    }
  }

  // Cached stats for 5 seconds to avoid repeated scans
  private _getUserStatsCached = memoize(async (userId: string): Promise<{ totalResumes: number; customizations: number; downloads: number }> => {
    const userResumes = await db
      .select({
        id: resumes.id,
        status: resumes.status,
        downloads: resumes.downloads,
      })
      .from(resumes)
      .where(eq(resumes.userId, userId));
    
    return {
      totalResumes: userResumes.length,
      customizations: userResumes.filter(r => r.status === 'customized').length,
      downloads: userResumes.reduce((acc, curr) => acc + (curr.downloads ?? 0), 0)
    };
  }, { maxAge: CACHE_TTL, promise: true });

  async getUserStats(userId: string): Promise<{ totalResumes: number; customizations: number; downloads: number }> {
    try {
      return await this._getUserStatsCached(userId);
    } catch (error) {
      logger.error({ error: error }, 'Storage: Error fetching user stats:');
      throw new Error('Failed to fetch user stats: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  async getResumeById(id: string): Promise<Resume | undefined> {
    const [resume] = await db.select().from(resumes).where(eq(resumes.id, id));
    if (!resume) return undefined;
    return {
      ...resume,
      customizedContent: resume.customizedContent === null ? undefined : resume.customizedContent,
    } as Resume;
  }

  async updateResumeStatus(id: string, status: string): Promise<void> {
    await db
      .update(resumes)
      .set({ status, updatedAt: new Date() })
      .where(eq(resumes.id, id));
  }

  async updateResumeContent(id: string, content: string): Promise<void> {
    // Sanitize HTML content before persisting
    // DOCX processor removed - using basic HTML sanitization
    const safe = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    await db
      .update(resumes)
      .set({ customizedContent: safe, updatedAt: new Date() })
      .where(eq(resumes.id, id));
  }

  async deleteResume(id: string): Promise<void> {
    try {
      // Get resume info for cache invalidation and file cleanup
      const resume = await this.getResumeById(id);
      if (!resume) throw new Error('Resume not found');
      
      // Delete related records sequentially for HTTP adapter compatibility
      logger.info(`Deleting related data for resume: ${id}`);
      
      // Delete tech stacks
      await db.delete(techStacks).where(eq(techStacks.resumeId, id));
      logger.info('Tech stacks deleted');
      
      // Delete point groups
      await db.delete(pointGroups).where(eq(pointGroups.resumeId, id));
      logger.info('Point groups deleted');
      
      // Delete processing history
      await db.delete(processingHistory).where(eq(processingHistory.resumeId, id));
      logger.info('Processing history deleted');
      
      // Remove original file from disk if present
      try {
        const fs = await import('fs');
        const path = await import('path');
        if ((resume as any).originalPath) {
          const filePath = path.resolve(process.cwd(), (resume as any).originalPath as string);
          if (fs.existsSync(filePath)) {
            await (await import('fs/promises')).unlink(filePath);
            logger.info('Original file deleted');
          }
        }
      } catch (e) {
        logger.warn({ context: e }, 'Failed to delete original file from disk');
      }
      
      // Finally, delete the resume
      await db.delete(resumes).where(eq(resumes.id, id));
      logger.info('Resume deleted');
      
      // Invalidate cache after successful deletion
      this.invalidateUserCache(resume.userId);
      logger.info(`Resume ${id} successfully deleted`);
    } catch (error) {
      logger.error({ error: error }, 'Storage: Error deleting resume:');
      throw new Error('Failed to delete resume: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  // Tech stack operations with BATCH SUPPORT for ultra-fast processing
  async createTechStack(techStack: InsertTechStack): Promise<TechStack> {
    const [newTechStack] = await db.insert(techStacks).values(techStack).returning();
    return newTechStack;
  }

  // ULTRA-FAST: Create multiple tech stacks in a single batch operation
  async createTechStacksBatch(techStacksData: InsertTechStack[]): Promise<TechStack[]> {
    if (techStacksData.length === 0) return [];
    
    const results = await db.insert(techStacks).values(techStacksData).returning();
    return results;
  }

  async getTechStacksByResumeId(resumeId: string): Promise<TechStack[]> {
    return await db
      .select()
      .from(techStacks)
      .where(eq(techStacks.resumeId, resumeId));
  }

  async deleteTechStacksByResumeId(resumeId: string): Promise<void> {
    await db.delete(techStacks).where(eq(techStacks.resumeId, resumeId));
  }

  // Point group operations with BATCH SUPPORT
  async createPointGroup(pointGroup: InsertPointGroup): Promise<PointGroup> {
    const [newPointGroup] = await db.insert(pointGroups).values(pointGroup).returning();
    return newPointGroup;
  }

  // ULTRA-FAST: Create multiple point groups in a single batch operation
  async createPointGroupsBatch(pointGroupsData: InsertPointGroup[]): Promise<PointGroup[]> {
    if (pointGroupsData.length === 0) return [];
    
    const results = await db.insert(pointGroups).values(pointGroupsData).returning();
    return results;
  }

  async getPointGroupsByResumeId(resumeId: string): Promise<PointGroup[]> {
    return await db
      .select()
      .from(pointGroups)
      .where(eq(pointGroups.resumeId, resumeId))
      .orderBy(pointGroups.createdAt);
  }

  async deletePointGroupsByResumeId(resumeId: string): Promise<void> {
    await db.delete(pointGroups).where(eq(pointGroups.resumeId, resumeId));
  }

  // Processing history operations
  async createProcessingHistory(history: InsertProcessingHistory): Promise<ProcessingHistory> {
    const [newHistory] = await db.insert(processingHistory).values(history).returning();
    return newHistory;
  }

  async getProcessingHistoryByResumeId(resumeId: string): Promise<ProcessingHistory[]> {
    return await db
      .select()
      .from(processingHistory)
      .where(eq(processingHistory.resumeId, resumeId))
      .orderBy(desc(processingHistory.createdAt));
  }
  async deleteEphemeralResumesBySession(userId: string, sessionId: string | undefined): Promise<number> {
    if (!sessionId) return 0;
    try {
      const toDelete = await db
        .select({ id: resumes.id })
        .from(resumes)
        .where(
          and(
            eq(resumes.userId, userId),
            eq(resumes.ephemeral, true as any),
            eq(resumes.sessionId, sessionId)
          )
        );
      for (const row of toDelete) {
        await this.deleteResume(row.id);
      }
      return toDelete.length;
    } catch (e) {
      logger.warn({ context: e }, 'Storage: deleteEphemeralResumesBySession failed');
      return 0;
    }
  }

  async deleteEphemeralResumesByUser(userId: string): Promise<number> {
    try {
      const toDelete = await db
        .select({ id: resumes.id })
        .from(resumes)
        .where(and(eq(resumes.userId, userId), eq(resumes.ephemeral, true as any)));
      for (const row of toDelete) {
        await this.deleteResume(row.id);
      }
      return toDelete.length;
    } catch (e) {
      logger.warn({ context: e }, 'Storage: deleteEphemeralResumesByUser failed');
      return 0;
    }
  }

  async deleteExpiredEphemeralResumes(): Promise<number> {
    try {
      const now = new Date();
      const expired = await db
        .select({ id: resumes.id })
        .from(resumes)
        .where(and(eq(resumes.ephemeral, true as any), sql`${resumes.expiresAt} IS NOT NULL AND ${resumes.expiresAt} < ${now}`));
      for (const row of expired) {
        await this.deleteResume(row.id);
      }
      return expired.length;
    } catch (e) {
      logger.warn({ context: e }, 'Storage: deleteExpiredEphemeralResumes failed');
      return 0;
    }
  }
}

export const storage = new DatabaseStorage();
