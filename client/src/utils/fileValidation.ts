/**
 * File validation utilities for DOCX files
 */

export const DOCX_MAX_SIZE = 50 * 1024 * 1024; // 50MB
export const DOCX_MIN_SIZE = 1024; // 1KB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate DOCX file size and extension
 */
export function validateDOCXFile(file: File): FileValidationResult {
  // Check file extension
  if (!file.name.toLowerCase().endsWith('.docx')) {
    return {
      valid: false,
      error: 'Invalid file type. Only .docx files are supported.'
    };
  }

  // Check if file is empty
  if (file.size === 0 || file.size < DOCX_MIN_SIZE) {
    return {
      valid: false,
      error: 'File is empty or too small to be a valid document.'
    };
  }

  // Check file size
  if (file.size > DOCX_MAX_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const maxSizeMB = (DOCX_MAX_SIZE / 1024 / 1024).toFixed(0);
    return {
      valid: false,
      error: `File too large (${sizeMB}MB). Maximum size is ${maxSizeMB}MB.`
    };
  }

  return { valid: true };
}

/**
 * Validate DOCX file signature (ZIP header)
 * DOCX files are ZIP archives with a specific structure
 */
export async function validateDOCXSignature(file: File): Promise<boolean> {
  try {
    const header = await file.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(header);

    // DOCX files are ZIP files (PK signature: 0x50 0x4B 0x03 0x04)
    return bytes[0] === 0x50 && bytes[1] === 0x4B &&
           bytes[2] === 0x03 && bytes[3] === 0x04;
  } catch (error) {
    console.error('Error validating DOCX signature:', error);
    return false;
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Comprehensive file validation (size + signature)
 */
export async function validateDOCXFileComprehensive(file: File): Promise<FileValidationResult> {
  // First check basic validation
  const basicValidation = validateDOCXFile(file);
  if (!basicValidation.valid) {
    return basicValidation;
  }

  // Then check file signature
  const isValidFormat = await validateDOCXSignature(file);
  if (!isValidFormat) {
    return {
      valid: false,
      error: 'The file appears to be corrupted or is not a valid DOCX file. Please ensure it\'s a proper Microsoft Word document.'
    };
  }

  return { valid: true };
}
