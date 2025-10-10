import { logger } from './logger';
import { circuitBreaker } from '../services/circuit-breaker';

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition?: (error: unknown) => boolean;
}

export interface ErrorContext {
  operation: string;
  userId?: string;
  resumeId?: string;
  metadata?: Record<string, any>;
}

export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private errorPatterns = new Map<string, number>();
  private recoveryStrategies = new Map<string, Function>();

  static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  /**
   * Retry function with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    context: ErrorContext
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffFactor = 2,
      retryCondition = this.defaultRetryCondition
    } = options;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        // Log successful recovery if it wasn't the first attempt
        if (attempt > 1) {
          logger.info({
            ...context,
            attempt,
            success: true
          }, `Operation recovered after ${attempt} attempts`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if we should retry
        if (attempt === maxAttempts || !retryCondition(error)) {
          break;
        }

        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt - 1),
          maxDelay
        );

        logger.warn({
          ...context,
          attempt,
          error: getErrorMessage(error),
          nextRetryIn: delay
        }, `Operation failed, retrying in ${delay}ms`);

        await this.sleep(delay);
      }
    }

    // Track error patterns for analysis
    this.trackErrorPattern(context.operation, lastError);

    // Log final failure
    logger.error({
      ...context,
      maxAttempts,
      finalError: getErrorMessage(lastError)
    }, `Operation failed after ${maxAttempts} attempts`);

    throw lastError;
  }

  /**
   * Circuit breaker with automatic recovery
   */
  async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    serviceName: string,
    context: ErrorContext
  ): Promise<T> {
    const breaker = await circuitBreaker.createBreaker(
      serviceName,
      operation,
      {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        persistState: true,
        fallback: async () => {
          return this.getFallbackResult(serviceName, context);
        }
      }
    );

    return breaker.fire() as unknown as T;
  }

  /**
   * Auto-recovery for DOCX processing errors
   */
  async recoverDocxProcessing(
    originalOperation: () => Promise<any>,
    buffer: Buffer,
    context: ErrorContext
  ): Promise<any> {
    return this.retryWithBackoff(
      async () => {
        try {
          return await originalOperation();
        } catch (error) {
          // Try alternative processing strategies
          const msg = getErrorMessage(error).toLowerCase();
          if (msg.includes('corrupted') || msg.includes('invalid')) {
            logger.info(context, 'Attempting DOCX repair and reprocessing');
            return await this.attemptDocxRepair(buffer, context);
          }
          throw error;
        }
      },
      {
        maxAttempts: 3,
        baseDelay: 2000,
        retryCondition: (error: unknown) => {
          const msg = getErrorMessage(error).toLowerCase();
          return !msg.includes('unsupported') && !msg.includes('permissions');
        }
      },
      context
    );
  }

  /**
   * Auto-recovery for database operations
   */
  async recoverDatabaseOperation<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    return this.retryWithBackoff(
      operation,
      {
        maxAttempts: 5,
        baseDelay: 500,
        maxDelay: 10000,
        retryCondition: (error: unknown) => {
          // Retry on connection issues, timeouts, and temporary failures
          const retryableErrors = [
            'connection', 'timeout', 'temporary', 'deadlock',
            'lock', 'busy', 'unavailable'
          ];
          const msg = getErrorMessage(error).toLowerCase();
          return retryableErrors.some(keyword => msg.includes(keyword));
        }
      },
      context
    );
  }

  /**
   * Auto-recovery for Redis operations
   */
  async recoverRedisOperation<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    fallbackValue?: T
  ): Promise<T> {
    try {
      return await this.retryWithBackoff(
        operation,
        {
          maxAttempts: 3,
          baseDelay: 100,
          maxDelay: 1000,
          retryCondition: (error: unknown) => {
            const msg = getErrorMessage(error).toLowerCase();
            return msg.includes('connection') || msg.includes('timeout');
          }
        },
        context
      );
    } catch (error) {
      if (fallbackValue !== undefined) {
        logger.warn({
          ...context,
          fallback: true,
          error: getErrorMessage(error)
        }, 'Redis operation failed, using fallback value');
        return fallbackValue as T;
      }
      throw error;
    }
  }

  /**
   * Smart error categorization and handling
   */
  categorizeAndHandle(error: unknown, context: ErrorContext): {
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recoverable: boolean;
    suggestedAction: string;
  } {
    const errorMessage = getErrorMessage(error).toLowerCase();

    // Network/Connection Errors
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return {
        category: 'network',
        severity: 'medium',
        recoverable: true,
        suggestedAction: 'Retry with exponential backoff'
      };
    }

    // File Processing Errors
    if (errorMessage.includes('docx') || errorMessage.includes('file')) {
      const severity = errorMessage.includes('corrupted') ? 'high' : 'medium';
      return {
        category: 'file_processing',
        severity,
        recoverable: !errorMessage.includes('unsupported'),
        suggestedAction: 'Try alternative processing or file repair'
      };
    }

    // Database Errors
    if (errorMessage.includes('database') || errorMessage.includes('sql')) {
      return {
        category: 'database',
        severity: 'high',
        recoverable: !errorMessage.includes('constraint'),
        suggestedAction: 'Retry with connection pool refresh'
      };
    }

    // Authentication/Authorization Errors
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
      return {
        category: 'auth',
        severity: 'high',
        recoverable: false,
        suggestedAction: 'User needs to re-authenticate'
      };
    }

    // Rate Limiting Errors
    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      return {
        category: 'rate_limit',
        severity: 'low',
        recoverable: true,
        suggestedAction: 'Implement exponential backoff'
      };
    }

    // Default: Unknown Error
    return {
      category: 'unknown',
      severity: 'medium',
      recoverable: true,
      suggestedAction: 'Log for manual review and retry'
    };
  }

  /**
   * Graceful degradation handler
   */
  async withGracefulDegradation<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (primaryError) {
      logger.warn({
        ...context,
        primaryError: getErrorMessage(primaryError),
        degraded: true
      }, 'Primary operation failed, attempting fallback');

      try {
        const result = await fallbackOperation();
        logger.info({
          ...context,
          fallbackSuccess: true
        }, 'Fallback operation succeeded');
        return result;
      } catch (fallbackError) {
        logger.error({
          ...context,
          primaryError: getErrorMessage(primaryError),
          fallbackError: getErrorMessage(fallbackError)
        }, 'Both primary and fallback operations failed');
        
        throw new Error(
          `Primary operation failed: ${getErrorMessage(primaryError)}. ` +
          `Fallback also failed: ${getErrorMessage(fallbackError)}`
        );
      }
    }
  }

  /**
   * Error pattern tracking for proactive fixes
   */
  private trackErrorPattern(operation: string, error: unknown): void {
    const pattern = `${operation}:${error instanceof Error ? error.name : 'Unknown'}`;
    const count = this.errorPatterns.get(pattern) || 0;
    this.errorPatterns.set(pattern, count + 1);

    // Alert on recurring patterns
    if (count + 1 >= 5) {
      logger.error({
        pattern,
        occurrences: count + 1,
        needsAttention: true
      }, 'Recurring error pattern detected - needs investigation');
    }
  }

  private defaultRetryCondition(error: unknown): boolean {
    const nonRetryableErrors = [
      'validation', 'unauthorized', 'forbidden', 
      'not found', 'conflict', 'unsupported'
    ];
    
    const errorMessage = getErrorMessage(error).toLowerCase();
    return !nonRetryableErrors.some(keyword => errorMessage.includes(keyword));
  }

  private async attemptDocxRepair(buffer: Buffer, context: ErrorContext): Promise<any> {
    // Basic DOCX repair strategies using zip normalization
    logger.info(context, 'Attempting basic DOCX repair');
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);
      if (!zip.file('[Content_Types].xml')) {
        const minimal = '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n<Default Extension="xml" ContentType="application/xml"/>\n<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n</Types>';
        zip.file('[Content_Types].xml', minimal);
      }
      if (!zip.folder('_rels')) zip.folder('_rels');
      if (!zip.folder('word/_rels')) zip.folder('word/_rels');
      if (!zip.file('word/document.xml')) {
        const minimalDoc = '<?xml version="1.0" encoding="UTF-8"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Recovered document</w:t></w:r></w:p></w:body></w:document>';
        zip.file('word/document.xml', minimalDoc);
      }
      const rebuilt = await zip.generateAsync({ type: 'nodebuffer' });
      logger.info(context, 'DOCX repair completed');
      return { repaired: true, buffer: rebuilt };
    } catch (e) {
      logger.error(context, 'DOCX repair failed');
      throw new Error('DOCX repair failed');
    }
  }

  private async getFallbackResult(serviceName: string, context: ErrorContext): Promise<any> {
    logger.warn({
      serviceName,
      ...context
    }, 'Circuit breaker open - providing fallback result');

    // Provide reasonable fallbacks based on service
    switch (serviceName) {
      case 'docx-processing':
        return {
          html: '<p>Document processing temporarily unavailable</p>',
          metadata: {
            wordCount: 0,
            pageCount: 1,
            processingTime: 0,
            fallback: true
          }
        };
      
      case 'user-stats':
        return {
          totalResumes: 0,
          customizations: 0,
          downloads: 0,
          fallback: true
        };

      default:
        return { 
          success: false, 
          fallback: true,
          message: 'Service temporarily unavailable'
        };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error recovery statistics
   */
  getStats() {
    return {
      errorPatterns: Object.fromEntries(this.errorPatterns),
      totalErrors: Array.from(this.errorPatterns.values()).reduce((sum, count) => sum + count, 0),
      uniquePatterns: this.errorPatterns.size
    };
  }
}

// Convenience function for common retry operations
export const withRetry = ErrorRecoveryService.getInstance().retryWithBackoff.bind(
  ErrorRecoveryService.getInstance()
);

// Convenience function for database operations
export const withDbRetry = ErrorRecoveryService.getInstance().recoverDatabaseOperation.bind(
  ErrorRecoveryService.getInstance()
);

// Convenience function for Redis operations  
export const withRedisRetry = ErrorRecoveryService.getInstance().recoverRedisOperation.bind(
  ErrorRecoveryService.getInstance()
);