import { z } from 'zod';

// File upload validation schemas
export const fileUploadSchema = z.object({
  name: z.string()
    .min(1, 'File name is required')
    .max(255, 'File name too long')
    .regex(/^[^<>:"/\\|?*]+$/, 'File name contains invalid characters'),
  size: z.number()
    .min(1, 'File cannot be empty')
    .max(50 * 1024 * 1024, 'File size must be less than 50MB'),
  type: z.string()
    .refine(
      (type) => [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/pdf'
      ].includes(type),
      'Only DOCX, DOC, and PDF files are supported'
    ),
});

// Resume content validation
export const resumeContentSchema = z.object({
  content: z.string()
    .min(100, 'Resume content should be at least 100 characters')
    .max(50000, 'Resume content is too long (max 50,000 characters)')
    .refine(
      (content) => content.trim().length > 0,
      'Resume content cannot be empty or only whitespace'
    )
    .refine(
      (content) => {
        // Check for balanced HTML tags if content contains HTML
        if (content.includes('<') && content.includes('>')) {
          const openTags = (content.match(/<(?!\/)[^>]+>/g) || []).length;
          const closeTags = (content.match(/<\/[^>]+>/g) || []).length;
          return Math.abs(openTags - closeTags) <= 5; // Allow some flexibility
        }
        return true;
      },
      'HTML tags appear to be unbalanced'
    ),
});

// Tech stack input validation
export const techStackInputSchema = z.object({
  input: z.string()
    .min(10, 'Tech stack input should be at least 10 characters')
    .max(10000, 'Tech stack input is too long')
    .refine(
      (input) => {
        const lines = input.split('\n').filter(line => line.trim());
        const techNames = lines.filter(line => !line.trim().startsWith('•') && !line.trim().startsWith('-'));
        return techNames.length > 0;
      },
      'At least one technology name is required'
    )
    .refine(
      (input) => {
        const lines = input.split('\n').filter(line => line.trim());
        const bulletPoints = lines.filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'));
        return bulletPoints.length > 0;
      },
      'At least one bullet point is required'
    ),
});

// Form validation schemas
export const loginSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .min(1, 'Email is required'),
  password: z.string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name is too long')
    .regex(/^[a-zA-Z\s-']+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name is too long')
    .regex(/^[a-zA-Z\s-']+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  email: z.string()
    .email('Please enter a valid email address')
    .min(1, 'Email is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Real-time validation utilities
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export const validateFileUpload = (files: FileList): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (files.length === 0) {
    errors.push('Please select at least one file');
    return { isValid: false, errors, warnings, suggestions };
  }

  if (files.length > 10) {
    errors.push('Maximum 10 files can be uploaded at once');
  }

  let totalSize = 0;
  const duplicateNames = new Set<string>();
  const seenNames = new Set<string>();

  Array.from(files).forEach((file, index) => {
    totalSize += file.size;

    // Check for duplicate names
    if (seenNames.has(file.name)) {
      duplicateNames.add(file.name);
    } else {
      seenNames.add(file.name);
    }

    // Validate individual file
    try {
      fileUploadSchema.parse({
        name: file.name,
        size: file.size,
        type: file.type
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          errors.push(`File ${index + 1} (${file.name}): ${err.message}`);
        });
      }
    }

    // Warnings for file characteristics
    if (file.size > 10 * 1024 * 1024) {
      warnings.push(`${file.name} is quite large (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
    }

    if (file.size < 10 * 1024) {
      warnings.push(`${file.name} seems very small (${(file.size / 1024).toFixed(1)}KB)`);
    }
  });

  // Check total upload size
  if (totalSize > 100 * 1024 * 1024) {
    errors.push(`Total upload size too large: ${(totalSize / 1024 / 1024).toFixed(1)}MB (max 100MB)`);
  }

  // Handle duplicates
  if (duplicateNames.size > 0) {
    warnings.push(`Duplicate file names detected: ${Array.from(duplicateNames).join(', ')}`);
    suggestions.push('Consider renaming files to avoid confusion');
  }

  // Suggestions
  if (files.length === 1) {
    suggestions.push('Tip: You can upload multiple files at once for batch processing');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
};

export const validateResumeContent = (content: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  try {
    resumeContentSchema.parse({ content });
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        errors.push(err.message);
      });
    }
  }

  // Content analysis
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  const lineCount = content.split('\n').length;
  const paragraphCount = content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

  // Word count analysis
  if (wordCount < 200) {
    warnings.push(`Resume seems short (${wordCount} words). Consider adding more details.`);
  } else if (wordCount > 1000) {
    warnings.push(`Resume is quite long (${wordCount} words). Consider being more concise.`);
  }

  // Structure analysis
  if (paragraphCount < 3) {
    suggestions.push('Consider organizing content into more sections (Summary, Experience, Skills, etc.)');
  }

  if (lineCount > 200) {
    warnings.push('Resume has many line breaks. Consider better formatting.');
  }

  // Content quality checks
  const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  const words = content.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words.filter(word => !commonWords.includes(word)));
  const vocabularyRatio = uniqueWords.size / words.length;

  if (vocabularyRatio < 0.3) {
    suggestions.push('Try using more varied vocabulary to make your resume stand out');
  }

  // Professional keywords check
  const professionalKeywords = [
    'achieved', 'improved', 'increased', 'developed', 'implemented', 'managed', 'led', 'created',
    'designed', 'optimized', 'collaborated', 'coordinated', 'delivered', 'executed', 'maintained'
  ];
  const foundKeywords = professionalKeywords.filter(keyword => 
    content.toLowerCase().includes(keyword)
  );

  if (foundKeywords.length < 3) {
    suggestions.push('Consider using more action-oriented professional keywords');
  }

  // HTML/formatting checks
  if (content.includes('<') && content.includes('>')) {
    const htmlTagCount = (content.match(/<[^>]+>/g) || []).length;
    if (htmlTagCount > 50) {
      warnings.push('Content has many HTML tags. Ensure formatting is clean.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
};

export const validateTechStackInput = (input: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  try {
    techStackInputSchema.parse({ input });
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        errors.push(err.message);
      });
    }
  }

  // Parse the structure
  const lines = input.split('\n').filter(line => line.trim());
  const techLines = lines.filter(line => !line.trim().match(/^[•\-\*]/));
  const bulletLines = lines.filter(line => line.trim().match(/^[•\-\*]/));

  // Structure validation
  if (techLines.length === 0) {
    errors.push('No technology names found');
  }

  if (bulletLines.length === 0) {
    errors.push('No bullet points found');
  }

  // Balance check
  const avgBulletsPerTech = bulletLines.length / techLines.length;
  if (avgBulletsPerTech < 2) {
    warnings.push(`Average of ${avgBulletsPerTech.toFixed(1)} bullet points per technology. Consider adding more details.`);
  } else if (avgBulletsPerTech > 5) {
    warnings.push(`Average of ${avgBulletsPerTech.toFixed(1)} bullet points per technology. Consider being more concise.`);
  }

  // Quality checks
  const shortBullets = bulletLines.filter(line => line.trim().length < 30);
  if (shortBullets.length > 0) {
    warnings.push(`${shortBullets.length} bullet point(s) seem quite short`);
  }

  const longBullets = bulletLines.filter(line => line.trim().length > 150);
  if (longBullets.length > 0) {
    warnings.push(`${longBullets.length} bullet point(s) are very long`);
  }

  // Suggestions
  if (techLines.length < 3) {
    suggestions.push('Consider adding more technologies to showcase your diverse skills');
  }

  if (techLines.length > 10) {
    suggestions.push('Consider focusing on your most relevant technologies');
  }

  // Check for common formatting issues
  const inconsistentBullets = bulletLines.some(line => {
    const bullet = line.trim()[0];
    return bullet !== '•' && bullet !== '-' && bullet !== '*';
  });

  if (inconsistentBullets) {
    suggestions.push('Use consistent bullet point formatting (•, -, or *)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
};

// Real-time validation hook utilities
export const debounce = (func: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export const createValidationState = () => ({
  isValidating: false,
  hasValidated: false,
  isValid: false,
  errors: [] as string[],
  warnings: [] as string[],
  suggestions: [] as string[],
  lastValidated: null as Date | null,
});

export type ValidationState = ReturnType<typeof createValidationState>;