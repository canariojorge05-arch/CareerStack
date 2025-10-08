import * as z from "zod";

// Password strength validation
export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/^(?=.*[a-z])/, "Password must contain at least one lowercase letter")
  .regex(/^(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
  .regex(/^(?=.*\d)/, "Password must contain at least one number")
  .regex(/^(?=.*[@$!%*?&])/, "Password must contain at least one special character (@$!%*?&)");

// Email validation
export const emailSchema = z.string()
  .email("Invalid email address")
  .min(1, "Email is required")
  .max(254, "Email is too long"); // RFC 5321 limit

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Registration form schema
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: "You must accept the terms and conditions",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Password strength calculator
export function calculatePasswordStrength(password: string): {
  score: number;
  feedback: string[];
  strength: 'weak' | 'medium' | 'strong';
} {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) {
    score++;
  } else {
    feedback.push("Use at least 8 characters");
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score++;
  } else {
    feedback.push("Add lowercase letters");
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    feedback.push("Add uppercase letters");
  }

  // Number check
  if (/\d/.test(password)) {
    score++;
  } else {
    feedback.push("Add numbers");
  }

  // Special character check
  if (/[@$!%*?&]/.test(password)) {
    score++;
  } else {
    feedback.push("Add special characters (@$!%*?&)");
  }

  // Additional checks for stronger passwords
  if (password.length >= 12) {
    score += 0.5;
  }

  if (/[^a-zA-Z0-9@$!%*?&]/.test(password)) {
    score += 0.5; // Bonus for additional special characters
  }

  // Avoid common patterns
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /(.)\1{2,}/, // Repeated characters
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      score -= 1;
      feedback.push("Avoid common patterns and repeated characters");
      break;
    }
  }

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong';
  if (score <= 2) {
    strength = 'weak';
  } else if (score <= 4) {
    strength = 'medium';
  } else {
    strength = 'strong';
  }

  return {
    score: Math.max(0, Math.min(5, score)),
    feedback,
    strength,
  };
}

// Email validation helper
export function isValidEmail(email: string): boolean {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
}

// Common email domains for suggestions
export const commonEmailDomains = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'protonmail.com',
];

// Email typo detection and suggestions
export function suggestEmailCorrection(email: string): string | null {
  const [localPart, domain] = email.split('@');
  if (!domain) return null;

  const domainLower = domain.toLowerCase();
  
  // Check for common typos
  const typoMap: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com',
  };

  if (typoMap[domainLower]) {
    return `${localPart}@${typoMap[domainLower]}`;
  }

  // Levenshtein distance for close matches
  for (const commonDomain of commonEmailDomains) {
    if (levenshteinDistance(domainLower, commonDomain) <= 2 && domainLower !== commonDomain) {
      return `${localPart}@${commonDomain}`;
    }
  }

  return null;
}

// Simple Levenshtein distance implementation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}
