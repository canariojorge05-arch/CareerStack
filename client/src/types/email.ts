/**
 * Shared Email Type Definitions
 * 
 * Centralized type definitions for the email module to:
 * - Prevent type duplication across components
 * - Ensure type consistency
 * - Make types easier to maintain
 */

export interface EmailAccount {
  id: string;
  accountName: string;
  emailAddress: string;
  provider: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface EmailAttachment {
  fileName: string;
  fileSize?: number;
  contentType?: string;
  content?: string;
}

export interface EmailMessage {
  id: string;
  subject: string;
  fromEmail: string;
  toEmails: string[];
  ccEmails: string[];
  htmlBody: string | null;
  textBody: string | null;
  sentAt: Date | null;
  isRead: boolean;
  isStarred: boolean;
  threadId: string;
  attachments?: EmailAttachment[];
}

export interface EmailThread {
  id: string;
  subject: string;
  participantEmails: string[];
  lastMessageAt: Date | null;
  messageCount: number;
  isArchived: boolean | null;
  labels: string[];
  messages?: EmailMessage[];
  preview?: string;
}

// Compose email data structure
export interface EmailComposeData {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments: File[];
}

// Email folder definition
export interface EmailFolder {
  id: string;
  name: string;
  icon: any; // Lucide icon component
  color: string;
  bgColor: string;
  count: number;
}

// API Response types
export interface EmailThreadsResponse {
  threads: EmailThread[];
  nextCursor?: number;
  total: number;
}

export interface EmailAccountsResponse {
  success: boolean;
  accounts: EmailAccount[];
}

// UI State types
export type EmailView = 'list' | 'split';

export interface ComposeState {
  isOpen: boolean;
  to: string;
  subject: string;
  body: string;
  attachments: File[];
}
