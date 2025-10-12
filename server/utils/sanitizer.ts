/**
 * Input Sanitization Utilities
 * Prevents XSS, SQL injection, and other malicious input
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 * Strips all HTML tags and dangerous characters
 */
export function sanitizeHTML(input: string): string {
  if (!input) return '';
  
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: protocol (can be used for XSS)
    .replace(/data:text\/html/gi, '')
    // Trim whitespace
    .trim();
}

/**
 * Sanitize plain text input
 * Removes control characters and normalizes whitespace
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove other control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  return email
    .toLowerCase()
    .trim()
    // Remove any characters that aren't valid in email addresses
    .replace(/[^a-z0-9@._+-]/g, '');
}

/**
 * Sanitize phone number
 * Keeps only digits, spaces, parentheses, hyphens, and plus sign
 */
export function sanitizePhone(phone: string): string {
  if (!phone) return '';
  
  return phone
    .trim()
    // Keep only valid phone characters
    .replace(/[^0-9()\s+-]/g, '');
}

/**
 * Sanitize URL
 */
export function sanitizeURL(url: string): string {
  if (!url) return '';
  
  try {
    // Parse URL to validate it
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    
    return parsed.toString();
  } catch {
    // Invalid URL
    return '';
  }
}

/**
 * Sanitize SSN
 * Removes all non-digit characters
 */
export function sanitizeSSN(ssn: string): string {
  if (!ssn) return '';
  
  // Keep only digits
  const digits = ssn.replace(/\D/g, '');
  
  // Format as XXX-XX-XXXX if 9 digits
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
  }
  
  return digits;
}

/**
 * Sanitize date input
 */
export function sanitizeDate(date: string): string | null {
  if (!date) return null;
  
  try {
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  } catch {
    return null;
  }
}

/**
 * Sanitize integer
 */
export function sanitizeInteger(value: any): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  const num = parseInt(String(value), 10);
  if (isNaN(num)) {
    return null;
  }
  
  return num;
}

/**
 * Sanitize object recursively
 * Applies appropriate sanitization to each field
 */
export function sanitizeObject(obj: any, schema?: Record<string, string>): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      sanitized[key] = value;
      continue;
    }
    
    // Determine type from schema or infer from value
    const type = schema?.[key] || inferType(key, value);
    
    switch (type) {
      case 'html':
        sanitized[key] = sanitizeHTML(String(value));
        break;
      case 'email':
        sanitized[key] = sanitizeEmail(String(value));
        break;
      case 'phone':
        sanitized[key] = sanitizePhone(String(value));
        break;
      case 'url':
        sanitized[key] = sanitizeURL(String(value));
        break;
      case 'ssn':
        sanitized[key] = sanitizeSSN(String(value));
        break;
      case 'date':
        sanitized[key] = sanitizeDate(String(value));
        break;
      case 'integer':
        sanitized[key] = sanitizeInteger(value);
        break;
      case 'text':
      default:
        if (typeof value === 'string') {
          sanitized[key] = sanitizeText(value);
        } else if (typeof value === 'object') {
          sanitized[key] = sanitizeObject(value, schema);
        } else {
          sanitized[key] = value;
        }
    }
  }
  
  return sanitized;
}

/**
 * Infer sanitization type from field name and value
 */
function inferType(fieldName: string, value: any): string {
  const lower = fieldName.toLowerCase();
  
  if (lower.includes('email')) return 'email';
  if (lower.includes('phone')) return 'phone';
  if (lower.includes('url') || lower.includes('website') || lower.includes('link')) return 'url';
  if (lower.includes('ssn')) return 'ssn';
  if (lower.includes('date') || lower.includes('time')) return 'date';
  if (lower.includes('description') || lower.includes('body') || lower.includes('content')) return 'html';
  if (typeof value === 'number') return 'integer';
  
  return 'text';
}

/**
 * Validate and sanitize consultant data
 */
export function sanitizeConsultantData(data: any): any {
  return sanitizeObject(data, {
    name: 'text',
    email: 'email',
    phone: 'phone',
    visaStatus: 'text',
    dateOfBirth: 'date',
    address: 'text',
    timezone: 'text',
    degreeName: 'text',
    university: 'text',
    yearOfPassing: 'text',
    ssn: 'ssn',
    howDidYouGetVisa: 'text',
    yearCameToUS: 'text',
    countryOfOrigin: 'text',
    whyLookingForNewJob: 'text',
  });
}

/**
 * Validate and sanitize requirement data
 */
export function sanitizeRequirementData(data: any): any {
  return sanitizeObject(data, {
    jobTitle: 'text',
    consultantId: 'text',
    nextStep: 'text',
    appliedFor: 'text',
    rate: 'text',
    remote: 'text',
    duration: 'text',
    clientCompany: 'text',
    impName: 'text',
    clientWebsite: 'url',
    impWebsite: 'url',
    vendorCompany: 'text',
    vendorWebsite: 'url',
    vendorPersonName: 'text',
    vendorPhone: 'phone',
    vendorEmail: 'email',
    primaryTechStack: 'text',
    completeJobDescription: 'html',
  });
}

/**
 * Validate and sanitize interview data
 */
export function sanitizeInterviewData(data: any): any {
  return sanitizeObject(data, {
    requirementId: 'text',
    interviewDate: 'date',
    interviewTime: 'text',
    timezone: 'text',
    interviewType: 'text',
    consultantId: 'text',
    vendorCompany: 'text',
    interviewWith: 'text',
    result: 'text',
    round: 'text',
    mode: 'text',
    meetingType: 'text',
    duration: 'text',
    subjectLine: 'text',
    interviewer: 'text',
    interviewLink: 'url',
    interviewFocus: 'text',
    specialNote: 'text',
    jobDescription: 'html',
    feedbackNotes: 'text',
  });
}
