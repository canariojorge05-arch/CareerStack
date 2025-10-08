import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      utmData?: Record<string, string>;
    }
  }
}

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const UTM_COOKIE_NAME = 'utm_data';
const UTM_COOKIE_MAX_AGE = 30 * 60 * 1000; // 30 minutes

export const utmTrackingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if we have UTM parameters in the query
    const utmData: Record<string, string> = {};
    let hasUtmParams = false;

    UTM_PARAMS.forEach(param => {
      const value = req.query[param];
      if (value && typeof value === 'string') {
        utmData[param] = value;
        hasUtmParams = true;
      }
    });

    if (hasUtmParams) {
      // Store UTM data in a cookie
      res.cookie(UTM_COOKIE_NAME, JSON.stringify(utmData), {
        maxAge: UTM_COOKIE_MAX_AGE,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    }

    // Attach UTM data to the request for use in activity logging
    if (hasUtmParams || req.cookies[UTM_COOKIE_NAME]) {
      req.utmData = hasUtmParams ? utmData : JSON.parse(req.cookies[UTM_COOKIE_NAME]);
    }

    next();
  } catch (error) {
    console.error('Error in UTM tracking middleware:', error);
    next(); // Continue even if tracking fails
  }
};