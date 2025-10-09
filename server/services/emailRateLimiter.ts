/**
 * Email Rate Limiter Service
 * Prevents sending too many emails too quickly (helps avoid spam filters)
 */

interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

export class EmailRateLimiter {
  private static limits = new Map<string, RateLimitEntry>();
  
  // Rate limits by provider
  private static PROVIDER_LIMITS = {
    gmail: {
      perHour: 100,
      perDay: 500,
    },
    outlook: {
      perHour: 150,
      perDay: 1000,
    },
    smtp: {
      perHour: 200,
      perDay: 2000,
    }
  };

  /**
   * Check if user can send email
   */
  static canSendEmail(
    userId: string, 
    provider: 'gmail' | 'outlook' | 'smtp' = 'smtp'
  ): { 
    allowed: boolean; 
    reason?: string; 
    resetAt?: Date;
    remaining?: number;
  } {
    const now = new Date();
    const hourKey = `${userId}:hour`;
    const dayKey = `${userId}:day`;

    // Check hourly limit
    const hourLimit = this.limits.get(hourKey);
    if (hourLimit) {
      if (now < hourLimit.resetAt) {
        const limits = this.PROVIDER_LIMITS[provider];
        if (hourLimit.count >= limits.perHour) {
          return {
            allowed: false,
            reason: `Hourly limit reached (${limits.perHour} emails/hour). Please wait before sending more emails.`,
            resetAt: hourLimit.resetAt,
            remaining: 0
          };
        }
      } else {
        // Reset expired limit
        this.limits.delete(hourKey);
      }
    }

    // Check daily limit
    const dayLimit = this.limits.get(dayKey);
    if (dayLimit) {
      if (now < dayLimit.resetAt) {
        const limits = this.PROVIDER_LIMITS[provider];
        if (dayLimit.count >= limits.perDay) {
          return {
            allowed: false,
            reason: `Daily limit reached (${limits.perDay} emails/day). Please try again tomorrow.`,
            resetAt: dayLimit.resetAt,
            remaining: 0
          };
        }
      } else {
        // Reset expired limit
        this.limits.delete(dayKey);
      }
    }

    const limits = this.PROVIDER_LIMITS[provider];
    const hourRemaining = limits.perHour - (hourLimit?.count || 0);
    const dayRemaining = limits.perDay - (dayLimit?.count || 0);

    return {
      allowed: true,
      remaining: Math.min(hourRemaining, dayRemaining)
    };
  }

  /**
   * Record email sent
   */
  static recordEmailSent(
    userId: string,
    provider: 'gmail' | 'outlook' | 'smtp' = 'smtp'
  ): void {
    const now = new Date();
    const hourKey = `${userId}:hour`;
    const dayKey = `${userId}:day`;

    // Update hourly count
    const hourLimit = this.limits.get(hourKey);
    if (hourLimit && now < hourLimit.resetAt) {
      hourLimit.count++;
    } else {
      const resetAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      this.limits.set(hourKey, { count: 1, resetAt });
    }

    // Update daily count
    const dayLimit = this.limits.get(dayKey);
    if (dayLimit && now < dayLimit.resetAt) {
      dayLimit.count++;
    } else {
      const resetAt = new Date(now);
      resetAt.setHours(24, 0, 0, 0); // Midnight tonight
      this.limits.set(dayKey, { count: 1, resetAt });
    }
  }

  /**
   * Get current usage statistics
   */
  static getUsageStats(userId: string): {
    hourly: { count: number; limit: number; resetAt?: Date };
    daily: { count: number; limit: number; resetAt?: Date };
  } {
    const hourKey = `${userId}:hour`;
    const dayKey = `${userId}:day`;
    const now = new Date();

    const hourLimit = this.limits.get(hourKey);
    const dayLimit = this.limits.get(dayKey);

    return {
      hourly: {
        count: (hourLimit && now < hourLimit.resetAt) ? hourLimit.count : 0,
        limit: this.PROVIDER_LIMITS.smtp.perHour,
        resetAt: hourLimit?.resetAt
      },
      daily: {
        count: (dayLimit && now < dayLimit.resetAt) ? dayLimit.count : 0,
        limit: this.PROVIDER_LIMITS.smtp.perDay,
        resetAt: dayLimit?.resetAt
      }
    };
  }

  /**
   * Reset limits for user (admin function)
   */
  static resetLimits(userId: string): void {
    this.limits.delete(`${userId}:hour`);
    this.limits.delete(`${userId}:day`);
  }

  /**
   * Clean up expired limits (should be run periodically)
   */
  static cleanupExpiredLimits(): void {
    const now = new Date();
    for (const [key, value] of this.limits.entries()) {
      if (now >= value.resetAt) {
        this.limits.delete(key);
      }
    }
  }
}

// Cleanup expired limits every hour
setInterval(() => {
  EmailRateLimiter.cleanupExpiredLimits();
}, 60 * 60 * 1000);
