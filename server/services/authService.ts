import { randomBytes, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { addHours } from 'date-fns';
import { users, userDevices, accountActivityLogs } from '@shared/schema';
import { db } from '../db';
import { eq, and, lt } from 'drizzle-orm';
import { sendEmail as sendEmailNodemailer, emailTemplates } from '../utils/email';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '24h';

export class AuthService {
  // Generate JWT access token
  static generateAccessToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  // Hash password
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  // Generate a short-lived temp token for 2FA that encodes the code
  static async generate2FACode(userId: string, code: string): Promise<string> {
    // 10-minute expiry for the 2FA code token
    return jwt.sign({ userId, code }, JWT_SECRET, { expiresIn: '10m' });
  }

  // Verify temp token and return payload
  static verifyTempToken(token: string): { userId: string; code: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; code: string };
      if (!decoded?.userId || !decoded?.code) return null;
      return decoded;
    } catch {
      return null;
    }
  }

  // Generate refresh token and store it in the database
  static async generateRefreshToken(userId: string, userAgent: string, ipAddress: string) {
    const refreshToken = randomBytes(40).toString('hex');
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Get device info from user agent
    const deviceInfo = this.getDeviceInfo(userAgent);

    // Store ONLY a hash of the refresh token in the database
    const [device] = await db.insert(userDevices).values({
      userId,
      refreshToken: tokenHash,
      expiresAt,
      userAgent,
      ipAddress,
      ...deviceInfo,
    }).returning();

    return {
      refreshToken, // return the raw token to the client
      deviceId: device.id,
      expiresAt,
    };
  }

  // Periodic cleanup: revoke or remove expired refresh tokens
  static async cleanupExpiredRefreshTokens() {
    try {
      const now = new Date();

      // Identify devices that just expired and are not yet revoked
      const expiredActive = await db
        .select({ userId: userDevices.userId })
        .from(userDevices)
        .where(and(eq(userDevices.isRevoked, false), lt(userDevices.expiresAt, now)));

      // Revoke only tokens that are expired and not already revoked
      const result = await db
        .update(userDevices)
        .set({ isRevoked: true, updatedAt: now })
        .where(and(eq(userDevices.isRevoked, false), lt(userDevices.expiresAt, now)));

      const rows = (result as any)?.rowCount ?? (result as any)?.affectedRows ?? result;
      console.log(`[AuthService] Expired refresh tokens revoked — affected: ${rows}`);

      // Delete ephemeral resumes for affected users (auto-logout cleanup)
      try {
        const uniqueUserIds = Array.from(new Set(expiredActive.map(r => r.userId))).filter(Boolean) as string[];
        if (uniqueUserIds.length) {
          const { storage } = await import('../storage');
          for (const uid of uniqueUserIds) {
            try {
              await storage.deleteEphemeralResumesByUser(uid);
            } catch (e) {
              console.warn(`[AuthService] Failed to delete ephemeral resumes for user ${uid}:`, e);
            }
          }
        }
      } catch (e) {
        console.warn('[AuthService] Ephemeral resume cleanup after auto-logout failed:', e);
      }
    } catch (error) {
      console.error('[AuthService] Failed to cleanup expired refresh tokens:', error);
    }
  }

  // Verify refresh token and return new access token
  static async refreshAccessToken(refreshToken: string) {
    // Verify the refresh token by comparing a hash
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const device = await db.query.userDevices.findFirst({
      where: (userDevices, { eq, and, gt }) => 
        and(
          eq(userDevices.refreshToken, tokenHash),
          eq(userDevices.isRevoked, false),
          gt(userDevices.expiresAt, new Date())
        ),
      with: {
        user: true,
      },
    });

    if (!device) {
      throw new Error('Invalid or expired refresh token');
    }

    // Generate new access token
    const accessToken = this.generateAccessToken(device.userId);

    // Update last active time
    await db
      .update(userDevices)
      .set({ lastActive: new Date() })
      .where(eq(userDevices.id, device.id));

    return {
      accessToken,
      user: device.user,
    };
  }

  // Log account activity
  static async logActivity(
    userId: string, 
    activityType: string, 
    status: 'success' | 'failed', 
    metadata: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ) {
    await db.insert(accountActivityLogs).values({
      userId,
      activityType,
      status,
      metadata,
      ipAddress,
      userAgent,
    });
  }

  // Generate email verification token
  static generateEmailVerificationToken(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = addHours(new Date(), 24); // 24 hours from now
    return { token, tokenHash, expiresAt };
  }

  // Generate password reset token
  static generatePasswordResetToken(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = addHours(new Date(), 1); // 1 hour from now
    return { token, tokenHash, expiresAt };
  }

  // Get device info from user agent
  private static getDeviceInfo(userAgent: string) {
    // This is a simple implementation - you might want to use a library like 'ua-parser-js' for more accurate detection
    const ua = userAgent.toLowerCase();
    
    let deviceType = 'desktop';
    if (ua.includes('mobile')) deviceType = 'mobile';
    else if (ua.includes('tablet')) deviceType = 'tablet';

    let os = 'unknown';
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac os')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

    let browser = 'unknown';
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';

    return { deviceType, os, browser };
  }

  // Send verification email (SMTP)
  static async sendVerificationEmail(email: string, name: string, token: string) {
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;
    const { subject, html } = emailTemplates.verification(name, verificationUrl);
    
    console.log(`🔗 Generated verification URL for ${email}: ${appUrl}/verify-email?token=***`);
    
    try {
      const ok = await sendEmailNodemailer(email, subject, html, undefined, {
        category: 'email-verification',
        priority: 'high',
        replyTo: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
      });
      if (ok) {
        console.log(`✅ Verification email sent via SMTP to ${email}`);
        return { accepted: [email], rejected: [], messageId: 'local-smtp', response: 'OK' } as any;
      }
      console.warn(`⚠️ SMTP transporter reported failure sending verification email to ${email}`);
      return { accepted: [], rejected: [email], messageId: 'smtp-failed', response: 'FAILED' } as any;
    } catch (error) {
      console.error(`❌ Failed to send verification email to ${email}:`, error);
      return { accepted: [], rejected: [email], messageId: 'smtp-exception', response: String(error) } as any;
    }
  }

  // Send password reset email (SMTP)
  static async sendPasswordResetEmail(email: string, name: string, token: string) {
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    
    // Log the reset URL for debugging (remove token for security)
    console.log(`🔗 Generated password reset URL for ${email}: ${appUrl}/reset-password?token=***`);
    
    const { subject, html } = emailTemplates.passwordReset(name, resetUrl);
    try {
      const ok = await sendEmailNodemailer(email, subject, html, undefined, {
        category: 'password-reset',
        priority: 'high',
        replyTo: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
      });
      if (ok) {
        console.log(`✅ Password reset email sent via SMTP to ${email}`);
        return { accepted: [email], rejected: [], messageId: 'local-smtp', response: 'OK' } as any;
      }
      console.warn(`⚠️ SMTP transporter reported failure sending password reset email to ${email}`);
      return { accepted: [], rejected: [email], messageId: 'smtp-failed', response: 'FAILED' } as any;
    } catch (error) {
      console.error(`❌ Failed to send password reset email to ${email}:`, error);
      return { accepted: [], rejected: [email], messageId: 'smtp-exception', response: String(error) } as any;
    }
  }

  // Send 2FA code email (SMTP)
  static async sendTwoFactorCodeEmail(email: string, name: string, code: string) {
    const { subject, html } = emailTemplates.twoFactorCode(name, code);
    try {
      const ok = await sendEmailNodemailer(email, subject, html, undefined, {
        category: 'two-factor-auth',
        priority: 'high',
        replyTo: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
      });
      if (ok) {
        console.log(`✅ 2FA code email sent via SMTP to ${email}`);
        return { accepted: [email], rejected: [], messageId: 'local-smtp', response: 'OK' } as any;
      }
      console.warn(`⚠️ SMTP transporter reported failure sending 2FA email to ${email}`);
      return { accepted: [], rejected: [email], messageId: 'smtp-failed', response: 'FAILED' } as any;
    } catch (error) {
      console.error(`❌ Failed to send 2FA email to ${email}:`, error);
      return { accepted: [], rejected: [email], messageId: 'smtp-exception', response: String(error) } as any;
    }
  }

  // Verify email token
  static async verifyEmailToken(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const user = await db.query.users.findFirst({
      where: (users, { eq, and, gt }) => 
        and(
          eq(users.emailVerificationToken, tokenHash),
          gt(users.emailVerificationExpires, new Date())
        ),
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    // Mark email as verified
    await db
      .update(users)
      .set({ 
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return true;
  }

  // Verify password reset token
  static async verifyPasswordResetToken(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const user = await db.query.users.findFirst({
      where: (users, { eq, and, gt }) => 
        and(
          eq(users.passwordResetToken, tokenHash),
          gt(users.passwordResetExpires, new Date())
        ),
    });

    if (!user) {
      throw new Error('Invalid or expired password reset token');
    }

    return user;
  }
}
