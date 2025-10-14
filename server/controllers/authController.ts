import { Request, Response } from 'express';
import passport from 'passport';
import { AuthService } from '../services/authService';
import { users, userDevices } from '@shared/schema';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { TwoFactorAuth } from '../utils/twoFactor';
import { ActivityTracker } from '../utils/activityTracker';
import { EmailValidator } from '../utils/emailValidator';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';

function parseCookies(header?: string) {
  const result: Record<string, string> = {};
  if (!header) return result;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      result[k] = decodeURIComponent(v);
    }
  });
  return result;
}

function extractTracking(req: Request) {
  let referrer = (req.headers['referer'] || req.headers['referrer'] || '') as string;
  const q = req.query as Record<string, any>;
  const utm: any = {
    source: q.utm_source || undefined,
    medium: q.utm_medium || undefined,
    campaign: q.utm_campaign || undefined,
    term: q.utm_term || undefined,
    content: q.utm_content || undefined,
  };
  // If no UTM in query, fallback to cookie
  if (!utm.source && !utm.medium && !utm.campaign && !utm.term && !utm.content) {
    try {
      const cookies = parseCookies(req.headers.cookie as any);
      const raw = cookies['utm_params'];
      if (raw) {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        const obj = JSON.parse(decoded);
        if (obj?.utm) Object.assign(utm, obj.utm);
        if (!referrer && obj?.referrer) referrer = obj.referrer;
      }
    } catch {}
  }

  // Remove empty keys
  Object.keys(utm).forEach((k) => (utm as any)[k] === undefined && delete (utm as any)[k]);
  return { referrer, utm: Object.keys(utm).length ? utm : undefined };
}

export class AuthController {
  // Register a new user
  static async register(req: Request, res: Response) {
    const { email, password, firstName, lastName } = req.body;

    try {
      // Validate email format and check for common issues
      const emailValidation = await EmailValidator.validateEmail(email);
      if (!emailValidation.isValid) {
        return res.status(400).json({ 
          message: emailValidation.reason,
          suggestions: emailValidation.suggestions
        });
      }

      // Normalize email
      const normalizedEmail = EmailValidator.normalizeEmail(email);

      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
      });

      if (existingUser) {
        return res.status(409).json({ message: 'Email already in use' });
      }

      // Hash password and create user
      const hashedPassword = await AuthService.hashPassword(password);
      const verification = AuthService.generateEmailVerificationToken();

      const [user] = await db.insert(users).values({
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        emailVerificationToken: verification.tokenHash,
        emailVerificationExpires: verification.expiresAt,
      }).returning();

      // Send verification email (raw token)
      await AuthService.sendVerificationEmail(
        user.email,
        `${user.firstName} ${user.lastName}`.trim() || 'User',
        verification.token
      );

      // Log the registration with enhanced tracking
      const { referrer, utm } = extractTracking(req);
      await ActivityTracker.logActivity(
        user.id,
        'register',
        'success',
        { method: 'email', referrer, utm },
        req
      );

      res.status(201).json({ 
        message: 'Registration successful. Please check your email to verify your account.',
        userId: user.id,
      });
    } catch (error) {
      logger.error({ error: error }, 'Registration error:');
      res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
  }

  // Login user
  static login(req: Request, res: Response, next: any) {
    passport.authenticate('local', async (err: any, user: any, info: any) => {
      try {
        if (err) {
          logger.error({ error: err }, 'Passport authentication error:');
          return next(err);
        }

        if (!user) {
          logger.info('Login failed - no user:', info);
          return res.status(401).json({ 
            success: false,
            message: info.message || 'Invalid email or password' 
          });
        }

        // Check if account is locked
        if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
          return res.status(403).json({ 
            success: false,
            message: 'Account is temporarily locked due to too many failed attempts. Please try again later.' 
          });
        }

        // Check if email is verified
        if (!user.emailVerified) {
          return res.status(403).json({ 
            success: false,
            message: 'Please verify your email before logging in.',
            requiresVerification: true,
            userId: user.id,
          });
        }

        // Check if account is approved by admin
        if (user.approvalStatus === 'pending_approval') {
          return res.status(403).json({ 
            success: false,
            message: 'Your account is pending admin approval. You will receive an email once approved.',
            code: 'PENDING_APPROVAL'
          });
        }

        if (user.approvalStatus === 'rejected') {
          return res.status(403).json({ 
            success: false,
            message: 'Your account registration was not approved. Please contact support.',
            code: 'ACCOUNT_REJECTED'
          });
        }

        if (user.approvalStatus !== 'approved') {
          return res.status(403).json({ 
            success: false,
            message: 'Account verification pending. Please complete email verification first.',
            code: 'PENDING_VERIFICATION'
          });
        }

        // If 2FA is enabled, generate and send code
        if (user.twoFactorEnabled) {
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          const verificationToken = await AuthService.generate2FACode(user.id, code);
          
          await AuthService.sendTwoFactorCodeEmail(
            user.email,
            `${user.firstName} ${user.lastName}`.trim() || 'User',
            code
          );

          return res.status(200).json({
            success: true,
            message: 'Two-factor authentication required',
            requires2FA: true,
            tempToken: verificationToken,
          });
        }

        // If no 2FA required, proceed with login
        req.login(user, async (err) => {
          if (err) {
            logger.error({ error: err }, 'Login error:');
            return next(err);
          }
          
          // Get geolocation and device info
          const ipAddress = (req.ip || 'unknown').replace('::ffff:', '');
          const userAgent = req.headers['user-agent'] as string || '';
          
          // Parse device info
          const { DeviceParser } = await import('../utils/deviceParser');
          const deviceInfo = DeviceParser.parse(userAgent);
          
          // Get geolocation
          const { GeolocationService } = await import('../services/geolocationService');
          const geoData = await GeolocationService.getLocation(ipAddress);
          
          // Check for suspicious activity
          const { SuspiciousActivityDetector } = await import('../utils/suspiciousActivityDetector');
          const suspiciousCheck = await SuspiciousActivityDetector.analyze(user.id, {
            ipAddress,
            city: geoData.city,
            region: geoData.region,
            country: geoData.country,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            deviceType: deviceInfo.deviceType
          });
          
          // Log login to history
          const { loginHistory } = await import('@shared/schema');
          await db.insert(loginHistory).values({
            userId: user.id,
            status: 'success',
            ipAddress,
            city: geoData.city,
            region: geoData.region,
            country: geoData.country,
            countryCode: geoData.countryCode,
            timezone: geoData.timezone,
            isp: geoData.isp,
            latitude: geoData.latitude,
            longitude: geoData.longitude,
            userAgent,
            browser: deviceInfo.browser,
            browserVersion: deviceInfo.browserVersion,
            os: deviceInfo.os,
            osVersion: deviceInfo.osVersion,
            deviceType: deviceInfo.deviceType,
            deviceVendor: deviceInfo.deviceVendor,
            isSuspicious: suspiciousCheck.isSuspicious,
            suspiciousReasons: suspiciousCheck.reasons,
            isNewLocation: suspiciousCheck.isNewLocation,
            isNewDevice: suspiciousCheck.isNewDevice
          });
          
          // Send alerts if suspicious or new device
          if (suspiciousCheck.isSuspicious) {
            SuspiciousActivityDetector.alertAdmin(user.id, user.email, suspiciousCheck.reasons, {
              ipAddress,
              city: geoData.city,
              region: geoData.region,
              country: geoData.country,
              browser: deviceInfo.browser,
              os: deviceInfo.os,
              deviceType: deviceInfo.deviceType
            });
          }
          
          if (suspiciousCheck.isNewDevice) {
            SuspiciousActivityDetector.notifyUser(user.email, `${user.firstName} ${user.lastName}`.trim() || 'User', {
              ipAddress,
              city: geoData.city,
              region: geoData.region,
              country: geoData.country,
              browser: deviceInfo.browser,
              os: deviceInfo.os,
              deviceType: deviceInfo.deviceType
            });
          }
          
          // Generate tokens
          const accessToken = AuthService.generateAccessToken(user.id);
          const refreshToken = await AuthService.generateRefreshToken(
            user.id,
            userAgent,
            ipAddress
          );

          // Update last login with full tracking info
          await db
            .update(users)
            .set({ 
              lastLoginAt: new Date(),
              lastIpAddress: ipAddress,
              lastUserAgent: userAgent,
              lastLoginCity: geoData.city,
              lastLoginCountry: geoData.country,
              lastLoginBrowser: deviceInfo.browser,
              lastLoginOs: deviceInfo.os,
              lastLoginDevice: deviceInfo.deviceType,
              failedLoginAttempts: 0,
              accountLockedUntil: null,
            })
            .where(eq(users.id, user.id));

          // Log successful login with enhanced tracking
          {
            const { referrer, utm } = extractTracking(req);
            await ActivityTracker.logActivity(
              user.id,
              'login',
              'success',
              { method: 'email', twoFactor: false, referrer, utm },
              req
            );
          }

          // Return tokens and user info (without sensitive data)
          const { password: _, ...userWithoutPassword } = user;
          
          // Ensure session state is persisted before responding to avoid race conditions
          if (req.session) {
            req.session.save(() => {
              res.json({
                success: true,
                user: userWithoutPassword,
                accessToken,
                refreshToken,
              });
            });
          } else {
            res.json({
              success: true,
              user: userWithoutPassword,
              accessToken,
              refreshToken,
            });
          }
        });
      } catch (error) {
        logger.error({ error: error }, 'Login error:');
        next(error);
      }
    })(req, res, next);
  }

  // Verify 2FA code
  static async verify2FACode(req: Request, res: Response) {
    const { code, tempToken } = req.body;

    try {
      // Verify the temp token and get user ID
      const decoded = AuthService.verifyTempToken(tempToken);
      if (!decoded || !decoded.userId || !decoded.code) {
        return res.status(400).json({ message: 'Invalid or expired verification request' });
      }

      // In a real app, you would verify the code against the stored value
      // For this example, we'll just check if it matches the one we sent
      if (code !== decoded.code) {
        // Log failed attempt
        {
          const { referrer, utm } = extractTracking(req);
          await ActivityTracker.logActivity(
            decoded.userId,
'two_factor_verify',
            'failure',
            { method: 'email', referrer, utm },
            req
          );
        }
        
        return res.status(400).json({ message: 'Invalid verification code' });
      }

      // Generate tokens
      const accessToken = AuthService.generateAccessToken(decoded.userId);
      const refreshToken = await AuthService.generateRefreshToken(
        decoded.userId,
        req.headers['user-agent'] as string,
        (req.ip || '')
      );

      // Get user data
      const user = await db.query.users.findFirst({
        where: eq(users.id, decoded.userId),
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Update last login
      await db
        .update(users)
        .set({ 
          lastLoginAt: new Date(),
          lastIpAddress: req.ip,
          lastUserAgent: req.headers['user-agent'],
          failedLoginAttempts: 0, // Reset failed attempts
          accountLockedUntil: null,
        })
        .where(eq(users.id, user.id));

      // Log successful 2FA verification
      {
        const { referrer, utm } = extractTracking(req);
        await ActivityTracker.logActivity(
          user.id,
'two_factor_verify',
          'success',
          { method: 'email', referrer, utm },
          req
        );
      }

      // Return tokens and user info (without sensitive data)
      const { password, ...userWithoutPassword } = user;
      
      res.json({
        user: userWithoutPassword,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      logger.error({ error: error }, '2FA verification error:');
      res.status(500).json({ message: 'Two-factor authentication failed' });
    }
  }

  // Request password reset
  static async requestPasswordReset(req: Request, res: Response) {
    const { email } = req.body;

    try {
      // Quick email validation (without DNS check for performance)
      const emailValidation = EmailValidator.validateEmailQuick(email);
      if (!emailValidation.isValid) {
        // Still return success to prevent email enumeration
        return res.json({ 
          message: 'If an account with that email exists, a password reset link has been sent.' 
        });
      }

      // Normalize email
      const normalizedEmail = EmailValidator.normalizeEmail(email);

      const user = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
      });

      if (user) {
        // Generate password reset token (returns raw token + tokenHash)
        const { token, tokenHash, expiresAt } = AuthService.generatePasswordResetToken() as any;

        // Save hashed token to user
        await db
          .update(users)
          .set({
            passwordResetToken: tokenHash,
            passwordResetExpires: expiresAt,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        // Send password reset email with raw token
        await AuthService.sendPasswordResetEmail(
          user.email,
          `${user.firstName} ${user.lastName}`.trim() || 'User',
          token
        );
      }

      // Always return success to prevent email enumeration
      res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    } catch (error) {
      logger.error({ error: error }, 'Password reset request error:');
      res.status(500).json({ message: 'Failed to process password reset request' });
    }
  }

  // Reset password
  static async resetPassword(req: Request, res: Response) {
    const { token, newPassword } = req.body;

    try {
      // Verify token and get user
      const user = await AuthService.verifyPasswordResetToken(token);
      
      // Hash new password
      const hashedPassword = await AuthService.hashPassword(newPassword);
      
      // Update password and clear reset token
      await db
        .update(users)
        .set({
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
          lastPasswordChange: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Log password reset
      {
        const { referrer, utm } = extractTracking(req);
        await ActivityTracker.logActivity(
          user.id,
          'password_reset',
          'success',
          { method: 'email', referrer, utm },
          req
        );
      }

      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      logger.error({ error: error }, 'Password reset error:');
      res.status(400).json({ message: 'Invalid or expired password reset token' });
    }
  }

  // Get current user
  static async getCurrentUser(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.user.id),
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Remove sensitive data
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      logger.error({ error: error }, 'Get current user error:');
      res.status(500).json({ message: 'Failed to fetch user data' });
    }
  }

  // Logout user (revoke refresh token)
  static async logout(req: Request, res: Response) {
    const { refreshToken } = req.body || {};

    // Capture identifying info for potential device revocation
    const currentUserId = req.user?.id as string | undefined;
    const currentUserAgent = (req.headers['user-agent'] || '') as string;
    const currentIp = (req.ip || '') as string;

    // If no refresh token is provided, perform a session-based logout
    if (!refreshToken) {
      try {
        // Attempt to revoke any refresh token stored for this device (userAgent + ip)
        if (currentUserId) {
          try {
            // Proactively remove any ephemeral resumes for this user
            try {
              const { storage } = await import('../storage');
              await storage.deleteEphemeralResumesByUser(currentUserId);
            } catch (cleanupErr) {
              logger.warn({ context: cleanupErr }, 'Failed to cleanup ephemeral resumes during logout:');
            }

            await db
              .update(userDevices)
              .set({ isRevoked: true, updatedAt: new Date() })
              .where(
                and(
                  eq(userDevices.userId, currentUserId),
                  eq(userDevices.userAgent, currentUserAgent),
                  eq(userDevices.ipAddress, currentIp),
                  eq(userDevices.isRevoked, false)
                )
              );

            // Log the revocation
            try {
              const { referrer, utm } = extractTracking(req);
              if (req.user) {
                await ActivityTracker.logActivity(
                  req.user.id,
                  'logout',
                  'success',
                  { method: 'session', revokedDevice: true, referrer, utm },
                  req
                );
              }
            } catch (logErr) {
              logger.warn({ context: logErr }, 'Failed to log device revocation during logout:');
            }
          } catch (dbErr) {
            // Non-fatal: proceed with logout even if we couldn't revoke device record
            logger.warn({ context: dbErr }, 'Failed to revoke device record during logout:');
          }
        }

        if (req.session) {
          // Use passport's logout helper and destroy the session
          req.logout(() => {
            req.session!.destroy((err) => {
              if (err) {
                logger.error({ error: err }, 'Session destruction error during logout:');
                return res.status(500).json({ message: 'Failed to complete logout' });
              }
              // Clear the session cookie with the same options used when setting it
              res.clearCookie('sid', {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
              });
              return res.json({ message: 'Logged out successfully' });
            });
          });
        } else {
          return res.json({ message: 'Already logged out' });
        }
      } catch (error) {
        logger.error({ error: error }, 'Logout (session) error:');
        return res.status(500).json({ message: 'Failed to log out' });
      }
      return;
    }

    // Otherwise, perform token-based logout (revoke refresh token)
    try {
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      await db
        .update(userDevices)
        .set({
          isRevoked: true,
          updatedAt: new Date(),
        })
        .where(eq(userDevices.refreshToken, tokenHash));

      // Clear cookie for token-based logout as well (best-effort)
      res.clearCookie('sid', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      // Log the logout
      if (req.user) {
        const { referrer, utm } = extractTracking(req);
        await ActivityTracker.logActivity(
          req.user.id,
          'logout',
          'success',
          { method: 'token', referrer, utm },
          req
        );
      }

      res.json({ message: 'Successfully logged out' });
    } catch (error) {
      logger.error({ error: error }, 'Logout (token) error:');
      res.status(500).json({ message: 'Failed to log out' });
    }
  }

  // Get user devices
  static async getUserDevices(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const devices = await db.query.userDevices.findMany({
        where: (userDevices, { eq }) => eq(userDevices.userId, req.user!.id),
        orderBy: (userDevices, { desc }) => [desc(userDevices.lastActive)],
      });

      res.json(devices);
    } catch (error) {
      logger.error({ error: error }, 'Get user devices error:');
      res.status(500).json({ message: 'Failed to fetch user devices' });
    }
  }

  // Revoke device
  static async revokeDevice(req: Request, res: Response) {
    const { deviceId } = req.params;

    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      // Verify the device belongs to the user
      const device = await db.query.userDevices.findFirst({
        where: (userDevices, { eq, and }) => 
          and(
            eq(userDevices.id, deviceId),
            eq(userDevices.userId, req.user!.id)
          ),
      });

      if (!device) {
        return res.status(404).json({ message: 'Device not found' });
      }

      // Revoke the device
      await db
        .update(userDevices)
        .set({ 
          isRevoked: true,
          updatedAt: new Date(),
        })
        .where(eq(userDevices.id, deviceId));

      res.json({ message: 'Device access revoked' });
    } catch (error) {
      logger.error({ error: error }, 'Revoke device error:');
      res.status(500).json({ message: 'Failed to revoke device' });
    }
  }

  // Resend email verification
  static async resendVerification(req: Request, res: Response) {
    try {
      const email = String(req.body?.email || '').toLowerCase().trim();
      if (!email || !/.+@.+\..+/.test(email)) {
        return res.status(400).json({ message: 'Invalid email' });
      }

      const user = await db.query.users.findFirst({ 
        where: eq(users.email, email) 
      });

      if (user?.emailVerified) {
        return res.json({ message: 'Email already verified' });
      }

      if (user) {
        const verification = AuthService.generateEmailVerificationToken();
        await db.update(users).set({
          emailVerificationToken: verification.tokenHash,
          emailVerificationExpires: verification.expiresAt,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));

        const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'User';
        await AuthService.sendVerificationEmail(email, name, verification.token);
      }

      // Always return success to avoid email enumeration
      res.json({ message: 'If an account exists, a verification email has been sent.' });
    } catch (error: any) {
      logger.error({ error: error }, 'Resend verification error:');
      res.status(500).json({ message: 'Failed to resend verification email' });
    }
  }
}
