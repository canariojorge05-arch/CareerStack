import { randomBytes, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { addHours } from 'date-fns';
import { users, userDevices, accountActivityLogs } from '@shared/schema';
import { db } from '../db';
import { eq, and, lt } from 'drizzle-orm';
import { sendEmail as sendEmailNodemailer, emailTemplates } from '../utils/email';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';

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
      logger.info(`[AuthService] Expired refresh tokens revoked — affected: ${rows}`);

      // Delete ephemeral resumes for affected users (auto-logout cleanup)
      try {
        const uniqueUserIds = Array.from(new Set(expiredActive.map(r => r.userId))).filter(Boolean) as string[];
        if (uniqueUserIds.length) {
          const { storage } = await import('../storage');
          for (const uid of uniqueUserIds) {
            try {
              await storage.deleteEphemeralResumesByUser(uid);
            } catch (e) {
              logger.warn(`[AuthService] Failed to delete ephemeral resumes for user ${uid}:`, e);
            }
          }
        }
      } catch (e) {
        logger.warn({ context: e }, '[AuthService] Ephemeral resume cleanup after auto-logout failed:');
      }
    } catch (error) {
      logger.error({ error: error }, '[AuthService] Failed to cleanup expired refresh tokens:');
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
    
    logger.info(`🔗 Generated verification URL for ${email}: ${appUrl}/verify-email?token=***`);
    
    try {
      const ok = await sendEmailNodemailer(email, subject, html, undefined, {
        category: 'email-verification',
        priority: 'high',
        replyTo: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
      });
      if (ok) {
        logger.info(`✅ Verification email sent via SMTP to ${email}`);
        return { accepted: [email], rejected: [], messageId: 'local-smtp', response: 'OK' } as any;
      }
      logger.warn(`⚠️ SMTP transporter reported failure sending verification email to ${email}`);
      return { accepted: [], rejected: [email], messageId: 'smtp-failed', response: 'FAILED' } as any;
    } catch (error) {
      logger.error(`❌ Failed to send verification email to ${email}:`, error);
      return { accepted: [], rejected: [email], messageId: 'smtp-exception', response: String(error) } as any;
    }
  }

  // Send password reset email (SMTP)
  static async sendPasswordResetEmail(email: string, name: string, token: string) {
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    
    // Log the reset URL for debugging (remove token for security)
    logger.info(`🔗 Generated password reset URL for ${email}: ${appUrl}/reset-password?token=***`);
    
    const { subject, html } = emailTemplates.passwordReset(name, resetUrl);
    try {
      const ok = await sendEmailNodemailer(email, subject, html, undefined, {
        category: 'password-reset',
        priority: 'high',
        replyTo: process.env.SUPPORT_EMAIL || process.env.EMAIL_USER
      });
      if (ok) {
        logger.info(`✅ Password reset email sent via SMTP to ${email}`);
        return { accepted: [email], rejected: [], messageId: 'local-smtp', response: 'OK' } as any;
      }
      logger.warn(`⚠️ SMTP transporter reported failure sending password reset email to ${email}`);
      return { accepted: [], rejected: [email], messageId: 'smtp-failed', response: 'FAILED' } as any;
    } catch (error) {
      logger.error(`❌ Failed to send password reset email to ${email}:`, error);
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
        logger.info(`✅ 2FA code email sent via SMTP to ${email}`);
        return { accepted: [email], rejected: [], messageId: 'local-smtp', response: 'OK' } as any;
      }
      logger.warn(`⚠️ SMTP transporter reported failure sending 2FA email to ${email}`);
      return { accepted: [], rejected: [email], messageId: 'smtp-failed', response: 'FAILED' } as any;
    } catch (error) {
      logger.error(`❌ Failed to send 2FA email to ${email}:`, error);
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

    // Mark email as verified and change status to pending_approval
    await db
      .update(users)
      .set({ 
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        approvalStatus: 'pending_approval', // Now waiting for admin approval
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Send notification to admin
    try {
      await this.sendAdminNotificationEmail(user.email, user.firstName || 'User');
    } catch (error) {
      logger.error({ error: error }, 'Failed to send admin notification:');
      // Don't fail verification if admin email fails
    }

    // Send pending approval email to user
    try {
      await this.sendPendingApprovalEmail(user.email, user.firstName || 'User');
    } catch (error) {
      logger.error({ error: error }, 'Failed to send pending approval email:');
    }

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

  // Send pending approval email to user
  static async sendPendingApprovalEmail(email: string, name: string) {
    const subject = 'Account Pending Admin Approval';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hi ${name},</h2>
        <p>Thank you for verifying your email address!</p>
        <p>Your account is currently <strong>pending admin approval</strong>. An administrator will review your registration shortly.</p>
        <p>You'll receive an email notification once your account has been approved. This usually takes 1-2 business days.</p>
        <p style="margin-top: 30px; color: #666;">If you have any questions, feel free to reply to this email.</p>
        <p style="color: #999; font-size: 12px; margin-top: 40px;">This is an automated message from ResumeCustomizer Pro.</p>
      </div>
    `;
    
    try {
      await sendEmailNodemailer(email, subject, html, undefined, {
        category: 'pending-approval',
        priority: 'normal'
      });
      logger.info(`✅ Pending approval email sent to ${email}`);
    } catch (error) {
      logger.error(`❌ Failed to send pending approval email to ${email}:`, error);
    }
  }

  // Send notification to admin about new signup
  static async sendAdminNotificationEmail(userEmail: string, userName: string) {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
    if (!adminEmail) {
      logger.warn('No admin email configured for new user notifications');
      return;
    }

    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const subject = '🔔 New User Registration - Pending Approval';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New User Signup</h2>
        <p>A new user has signed up and verified their email. Their account is waiting for your approval.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Name:</strong> ${userName}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p style="margin-top: 20px;">
          <a href="${appUrl}/admin/approvals" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Review in Admin Dashboard
          </a>
        </p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          You can approve or reject this user in your admin dashboard.
        </p>
      </div>
    `;
    
    try {
      await sendEmailNodemailer(adminEmail, subject, html, undefined, {
        category: 'admin-notification',
        priority: 'high'
      });
      logger.info(`✅ Admin notification sent to ${adminEmail}`);
    } catch (error) {
      logger.error(`❌ Failed to send admin notification:`, error);
    }
  }

  // Send approval confirmation email to user
  static async sendApprovalEmail(email: string, name: string) {
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const subject = '🎉 Your Account Has Been Approved!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;">Great News, ${name}!</h2>
        <p>Your account has been approved by an administrator.</p>
        <p>You can now log in and start using ResumeCustomizer Pro!</p>
        <p style="margin-top: 30px;">
          <a href="${appUrl}/login" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Login Now
          </a>
        </p>
        <p style="margin-top: 30px; color: #666;">Welcome aboard! We're excited to have you.</p>
        <p style="color: #999; font-size: 12px; margin-top: 40px;">This is an automated message from ResumeCustomizer Pro.</p>
      </div>
    `;
    
    try {
      await sendEmailNodemailer(email, subject, html, undefined, {
        category: 'account-approved',
        priority: 'high'
      });
      logger.info(`✅ Approval email sent to ${email}`);
    } catch (error) {
      logger.error(`❌ Failed to send approval email to ${email}:`, error);
    }
  }

  // Send rejection notification email to user
  static async sendRejectionEmail(email: string, name: string, reason?: string) {
    const subject = 'Account Registration Update';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hi ${name},</h2>
        <p>Thank you for your interest in ResumeCustomizer Pro.</p>
        <p>Unfortunately, we're unable to approve your account registration at this time.</p>
        ${reason ? `<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
        </div>` : ''}
        <p style="margin-top: 30px; color: #666;">
          If you believe this is an error or have questions, please contact our support team by replying to this email.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 40px;">This is an automated message from ResumeCustomizer Pro.</p>
      </div>
    `;
    
    try {
      await sendEmailNodemailer(email, subject, html, undefined, {
        category: 'account-rejected',
        priority: 'normal'
      });
      logger.info(`✅ Rejection email sent to ${email}`);
    } catch (error) {
      logger.error(`❌ Failed to send rejection email to ${email}:`, error);
    }
  }

  // Send suspicious login alert to admin
  static async sendSuspiciousLoginAlert(userId: string, userEmail: string, reasons: string[], loginDetails: any) {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
    if (!adminEmail) return;

    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const subject = '🚨 Suspicious Login Activity Detected';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⚠️ Suspicious Login Detected</h2>
        <p>A potentially suspicious login was detected for user: <strong>${userEmail}</strong></p>
        
        <div style="background: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3 style="margin: 0 0 10px 0; color: #991b1b;">Suspicious Reasons:</h3>
          <ul style="margin: 5px 0; padding-left: 20px;">
            ${reasons.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">Login Details:</h3>
          <p style="margin: 5px 0;"><strong>IP Address:</strong> ${loginDetails.ipAddress}</p>
          <p style="margin: 5px 0;"><strong>Location:</strong> ${loginDetails.city}, ${loginDetails.region}, ${loginDetails.country}</p>
          <p style="margin: 5px 0;"><strong>Device:</strong> ${loginDetails.browser} on ${loginDetails.os}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <p style="margin-top: 20px;">
          <a href="${appUrl}/admin" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Review in Admin Dashboard
          </a>
        </p>
      </div>
    `;
    
    try {
      await sendEmailNodemailer(adminEmail, subject, html, undefined, {
        category: 'security-alert',
        priority: 'high'
      });
      logger.info(`✅ Suspicious login alert sent to admin`);
    } catch (error) {
      logger.error(`❌ Failed to send suspicious login alert:`, error);
    }
  }

  // Send new device login notification to user
  static async sendNewDeviceLoginEmail(email: string, name: string, loginDetails: any) {
    const subject = '🔒 New Device Login Detected';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hi ${name},</h2>
        <p>We detected a login to your account from a new device.</p>
        
        <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0284c7;">
          <h3 style="margin: 0 0 10px 0; color: #0c4a6e;">Login Details:</h3>
          <p style="margin: 5px 0;"><strong>Location:</strong> ${loginDetails.city}, ${loginDetails.region}, ${loginDetails.country}</p>
          <p style="margin: 5px 0;"><strong>Device:</strong> ${loginDetails.browser} on ${loginDetails.os}</p>
          <p style="margin: 5px 0;"><strong>IP Address:</strong> ${loginDetails.ipAddress}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <p><strong>Was this you?</strong></p>
        <p>If you recognize this activity, you can safely ignore this email.</p>
        <p style="color: #dc2626; margin-top: 20px;">
          <strong>If this wasn't you:</strong> Please change your password immediately and contact support.
        </p>
        
        <p style="color: #999; font-size: 12px; margin-top: 40px;">This is an automated security message from ResumeCustomizer Pro.</p>
      </div>
    `;
    
    try {
      await sendEmailNodemailer(email, subject, html, undefined, {
        category: 'security-notification',
        priority: 'high'
      });
      logger.info(`✅ New device login notification sent to ${email}`);
    } catch (error) {
      logger.error(`❌ Failed to send new device notification to ${email}:`, error);
    }
  }
}
