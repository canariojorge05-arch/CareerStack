import { Strategy as LocalStrategy } from 'passport-local';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { compare } from 'bcryptjs';
import { logger } from '../utils/logger';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function configurePassport(passport: any) {
  // Local strategy for username/password authentication
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true,
      },
      async (req, email, password, done) => {
        try {
          // Find user by email
          const user = await db.query.users.findFirst({
            where: eq(users.email, email),
          });

          // If user not found
          if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
          }

          // If account is locked
          if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
            return done(null, false, {
              message: 'Account is temporarily locked. Please try again later.',
            });
          }

          // Check if password is correct
          const isMatch = await compare(password, user.password);
          if (!isMatch) {
            // Increment failed login attempts and lock if threshold reached
            const newCount = (user.failedLoginAttempts || 0) + 1;
            const shouldLock = newCount >= MAX_LOGIN_ATTEMPTS;
            await db
              .update(users)
              .set({
                failedLoginAttempts: newCount,
                accountLockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
              })
              .where(eq(users.id, user.id));

            return done(null, false, { message: shouldLock ? 'Account locked due to multiple failed attempts. Try again later.' : 'Invalid email or password' });
          }

          // If email is not verified
          if (!user.emailVerified) {
            return done(null, false, {
              message: 'Please verify your email before logging in.',
              requiresVerification: true,
            } as any);
          }

          // Reset failed login attempts on successful login
          if ((user.failedLoginAttempts || 0) > 0) {
            await db
              .update(users)
              .set({
                failedLoginAttempts: 0,
                accountLockedUntil: null,
              })
              .where(eq(users.id, user.id));
          }

          // Return user without password
          const { password: _, ...userWithoutPassword } = user;
          return done(null, userWithoutPassword);
        } catch (error) {
          logger.error({ error: error }, 'Passport error:');
          return done(error);
        }
      }
    )
  );

  // Serialize user into the session
  passport.serializeUser((user: any, done: any) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id: string, done: any) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
        columns: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          emailVerified: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      done(null, user || false);
    } catch (error) {
      logger.error({ error: error }, 'Deserialize user error:');
      done(error);
    }
  });
}
