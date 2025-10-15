import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// This table stores session data for server-side session management.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table with local authentication support
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  lastLoginAt: timestamp("last_login_at"),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: varchar("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: varchar("two_factor_secret"),
  twoFactorRecoveryCodes: text("two_factor_recovery_codes"),
  lastPasswordChange: timestamp("last_password_change").defaultNow(),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  accountLockedUntil: timestamp("account_locked_until"),
  lastIpAddress: varchar("last_ip_address"),
  lastUserAgent: text("last_user_agent"),
  // Extended login tracking (optional fields)
  lastLoginCity: varchar("last_login_city"),
  lastLoginCountry: varchar("last_login_country"),
  lastLoginBrowser: varchar("last_login_browser"),
  lastLoginOs: varchar("last_login_os"),
  lastLoginDevice: varchar("last_login_device"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Google Drive OAuth tokens (optional)
  googleAccessToken: varchar("google_access_token"),
  googleRefreshToken: varchar("google_refresh_token"),
  googleTokenExpiresAt: timestamp("google_token_expires_at"),
  googleDriveConnected: boolean("google_drive_connected").default(false),
  googleDriveEmail: varchar("google_drive_email"),
  // Role-based access control
  role: varchar("role").notNull().default("user"), // 'user' | 'marketing' | 'admin'
  // Admin approval system
  approvalStatus: varchar("approval_status").notNull().default("pending_approval"), // 'pending_verification' | 'pending_approval' | 'approved' | 'rejected'
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id, { onDelete: 'set null' }),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
});

// User devices/sessions table
export const userDevices = pgTable("user_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceName: varchar("device_name"),
  deviceType: varchar("device_type"),
  os: varchar("os"),
  browser: varchar("browser"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  lastActive: timestamp("last_active").defaultNow(),
  refreshToken: varchar("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isRevoked: boolean("is_revoked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Account activity log
export const accountActivityLogs = pgTable("account_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  activityType: varchar("activity_type").notNull(), // login, logout, password_change, etc.
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  status: varchar("status").notNull(), // success, failed
  metadata: jsonb("metadata"), // Additional data about the activity
  createdAt: timestamp("created_at").defaultNow(),
});

// Login history table - detailed tracking of all login attempts
export const loginHistory = pgTable("login_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Login status
  status: varchar("status").notNull(), // 'success' | 'failed' | 'blocked'
  failureReason: varchar("failure_reason"), // Why login failed
  
  // IP and Geolocation
  ipAddress: varchar("ip_address").notNull(),
  city: varchar("city"),
  region: varchar("region"), // State/Province
  country: varchar("country"),
  countryCode: varchar("country_code"), // US, GB, etc.
  timezone: varchar("timezone"),
  isp: varchar("isp"), // Internet Service Provider
  latitude: varchar("latitude"),
  longitude: varchar("longitude"),
  
  // Device Information
  userAgent: text("user_agent"),
  browser: varchar("browser"),
  browserVersion: varchar("browser_version"),
  os: varchar("os"),
  osVersion: varchar("os_version"),
  deviceType: varchar("device_type"), // desktop, mobile, tablet
  deviceVendor: varchar("device_vendor"),
  
  // Security flags
  isSuspicious: boolean("is_suspicious").default(false),
  suspiciousReasons: text("suspicious_reasons").array(),
  isNewLocation: boolean("is_new_location").default(false),
  isNewDevice: boolean("is_new_device").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_login_history_user_id").on(table.userId),
  index("idx_login_history_status").on(table.status),
  index("idx_login_history_created_at").on(table.createdAt),
  index("idx_login_history_ip_address").on(table.ipAddress),
  index("idx_login_history_suspicious").on(table.isSuspicious),
]);

export const resumes = pgTable("resumes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileName: varchar("file_name").notNull(),
  originalContent: text("original_content"), // Deprecated: previously stored base64 DOCX content
  originalPath: varchar("original_path"), // Filesystem path to original DOCX
  customizedContent: text("customized_content"), // Store edited content (HTML)
  fileSize: integer("file_size").notNull(),
  status: varchar("status").notNull().default("uploaded"), // uploaded, processing, ready, customized
  downloads: integer("downloads").notNull().default(0),
  // Ephemeral handling (short-lived resumes tied to session)
  ephemeral: boolean("ephemeral").notNull().default(true),
  sessionId: varchar("session_id"),
  expiresAt: timestamp("expires_at"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // PERFORMANCE INDEXES for lightning-fast queries
  index("idx_resumes_user_id").on(table.userId),
  index("idx_resumes_status").on(table.status),
  index("idx_resumes_uploaded_at").on(table.uploadedAt),
  index("idx_resumes_user_status").on(table.userId, table.status), // Composite index for user stats
  index("idx_resumes_user_ephemeral").on(table.userId, table.ephemeral),
  index("idx_resumes_expires_at").on(table.expiresAt),
]);

export const techStacks = pgTable("tech_stacks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resumeId: varchar("resume_id").notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  bulletPoints: text("bullet_points").array().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_tech_stacks_resume_id").on(table.resumeId),
]);

export const pointGroups = pgTable("point_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resumeId: varchar("resume_id").notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  points: jsonb("points").notNull(), // Array of {techStack: string, text: string}
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_point_groups_resume_id").on(table.resumeId),
]);

export const processingHistory = pgTable("processing_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resumeId: varchar("resume_id").notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  input: text("input").notNull(),
  output: jsonb("output").notNull(),
  settings: jsonb("settings"), // Processing settings like points per group
  processingTime: integer("processing_time"), // in milliseconds
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_processing_history_resume_id").on(table.resumeId),
  index("idx_processing_history_created_at").on(table.createdAt),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  resumes: many(resumes),
}));

export const resumesRelations = relations(resumes, ({ one, many }) => ({
  user: one(users, {
    fields: [resumes.userId],
    references: [users.id],
  }),
  techStacks: many(techStacks),
  pointGroups: many(pointGroups),
  processingHistory: many(processingHistory),
}));

export const techStacksRelations = relations(techStacks, ({ one }) => ({
  resume: one(resumes, {
    fields: [techStacks.resumeId],
    references: [resumes.id],
  }),
}));

export const pointGroupsRelations = relations(pointGroups, ({ one }) => ({
  resume: one(resumes, {
    fields: [pointGroups.resumeId],
    references: [resumes.id],
  }),
}));

export const processingHistoryRelations = relations(processingHistory, ({ one }) => ({
  resume: one(resumes, {
    fields: [processingHistory.resumeId],
    references: [resumes.id],
  }),
}));

// Auth rate limiting table (per email+ip)
export const authRateLimits = pgTable("auth_rate_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  ip: varchar("ip").notNull(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start").notNull().defaultNow(),
  blockedUntil: timestamp("blocked_until"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_auth_rate_limits_email_ip").on(table.email, table.ip),
  index("idx_auth_rate_limits_window").on(table.windowStart),
]);

// Rate limit table for email actions (e.g., resend verification)
export const emailRateLimits = pgTable("email_rate_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: varchar("action").notNull(),
  email: varchar("email").notNull(),
  ip: varchar("ip").notNull(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start").notNull().defaultNow(),
  blockedUntil: timestamp("blocked_until"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("uq_email_rate_limits_action_email_ip").on(table.action, table.email, table.ip),
  index("idx_email_rate_limits_window").on(table.windowStart),
]);

// Insert schemas
export const insertResumeSchema = createInsertSchema(resumes).omit({
  id: true,
  uploadedAt: true,
  updatedAt: true,
});

export const insertTechStackSchema = createInsertSchema(techStacks).omit({
  id: true,
  createdAt: true,
});

export const insertPointGroupSchema = createInsertSchema(pointGroups).omit({
  id: true,
  createdAt: true,
});

export const insertProcessingHistorySchema = createInsertSchema(processingHistory).omit({
  id: true,
  createdAt: true,
});

// Marketing Module Tables

// Consultants table
export const consultants = pgTable("consultants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  displayId: varchar("display_id"), // CONST ID - 1, CONST ID - 2, etc.
  
  // Consultant Info
  status: varchar("status").notNull().default("Active"), // Active, Not Active
  name: text("name").notNull(),
  visaStatus: text("visa_status"),
  dateOfBirth: timestamp("date_of_birth"),
  address: text("address"),
  email: varchar("email").notNull().unique(),
  phone: varchar("phone"),
  timezone: text("timezone"),
  degreeName: varchar("degree_name"),
  university: varchar("university"),
  yearOfPassing: varchar("year_of_passing"),
  ssn: varchar("ssn"), // Encrypted in production
  howDidYouGetVisa: text("how_did_you_get_visa"),
  yearCameToUS: varchar("year_came_to_us"),
  countryOfOrigin: varchar("country_of_origin"),
  whyLookingForNewJob: text("why_looking_for_new_job"),
  
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_consultants_status").on(table.status),
  index("idx_consultants_email").on(table.email),
  index("idx_consultants_created_by").on(table.createdBy),
  index("idx_consultants_created_at").on(table.createdAt),
]);

// Consultant projects table for resume info
export const consultantProjects = pgTable("consultant_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consultantId: varchar("consultant_id").notNull().references(() => consultants.id, { onDelete: 'cascade' }),
  
  projectName: varchar("project_name").notNull(),
  projectDomain: varchar("project_domain"),
  projectCity: varchar("project_city"),
  projectState: varchar("project_state"),
  projectStartDate: varchar("project_start_date"), // MM/YYYY format
  projectEndDate: varchar("project_end_date"), // MM/YYYY format
  isCurrentlyWorking: boolean("is_currently_working").default(false),
  projectDescription: text("project_description"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_consultant_projects_consultant_id").on(table.consultantId),
  index("idx_consultant_projects_created_at").on(table.createdAt),
]);

// Requirements table
export const requirements = pgTable("requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  displayId: varchar("display_id"), // REQ ID - 1, REQ ID - 2, etc.
  // Requirement & Communication
  status: varchar("status").notNull().default("New"), // New, Working, Applied, Submitted, Interviewed, Cancelled
  consultantId: varchar("consultant_id").references(() => consultants.id, { onDelete: 'set null' }), // Reference to consultant
  nextStep: text("next_step"),
  appliedFor: varchar("applied_for").notNull().default("Rahul"),
  rate: text("rate"),
  remote: text("remote"),
  duration: text("duration"),
  marketingComments: jsonb("marketing_comments").notNull().default('[]'), // Array of {comment: string, timestamp: Date, userId: string}
  
  // Client & IMP Info
  clientCompany: varchar("client_company"),
  impName: varchar("imp_name"),
  clientWebsite: varchar("client_website"),
  impWebsite: varchar("imp_website"),
  
  // Vendor Info
  vendorCompany: varchar("vendor_company"),
  vendorWebsite: varchar("vendor_website"),
  vendorPersonName: varchar("vendor_person_name"),
  vendorPhone: varchar("vendor_phone"),
  vendorEmail: varchar("vendor_email"),
  
  // Job Requirement Info
  requirementEnteredDate: timestamp("requirement_entered_date").defaultNow(),
  gotRequirement: timestamp("got_requirement"),
  jobTitle: varchar("job_title"),
  primaryTechStack: varchar("primary_tech_stack"),
  completeJobDescription: text("complete_job_description"),
  
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_requirements_status").on(table.status),
  index("idx_requirements_consultant_id").on(table.consultantId),
  index("idx_requirements_created_by").on(table.createdBy),
  index("idx_requirements_created_at").on(table.createdAt),
]);

// Interviews table
export const interviews = pgTable("interviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  displayId: varchar("display_id"), // INT ID - 1, INT ID - 2, etc.
  requirementId: varchar("requirement_id").notNull().references(() => requirements.id, { onDelete: 'cascade' }),
  
  // Interview Details
  interviewDate: timestamp("interview_date"),
  interviewTime: varchar("interview_time"), // e.g., "10:30 AM"
  timezone: varchar("timezone").notNull().default("EST"), // EST, CST, MST, PST
  interviewType: varchar("interview_type"),
  status: varchar("status").notNull().default("Confirmed"), // All, Cancelled, Re-Scheduled, Confirmed, Completed
  consultantId: varchar("consultant_id").references(() => consultants.id, { onDelete: 'set null' }), // Reference to consultant
  marketingPersonId: varchar("marketing_person_id").references(() => users.id, { onDelete: 'set null' }),
  vendorCompany: varchar("vendor_company"),
  interviewWith: varchar("interview_with"), // Client/IMP/Vendor
  result: varchar("result"), // Offer/Positive/Negative/No feedback
  round: varchar("round"), // 1,2,3,Final
  mode: varchar("mode"), // Phone/Video/Video+Coding
  meetingType: varchar("meeting_type"),
  duration: varchar("duration"),
  
  // Details of Interview
  subjectLine: text("subject_line"),
  interviewer: text("interviewer"),
  interviewLink: text("interview_link"),
  interviewFocus: varchar("interview_focus"), // auto-pick from Requirement Primary Tech Stack
  specialNote: text("special_note"),
  jobDescription: text("job_description"), // auto-pick from Requirement
  
  // Interview Feedback
  feedbackNotes: text("feedback_notes"),
  
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_interviews_requirement_id").on(table.requirementId),
  index("idx_interviews_consultant_id").on(table.consultantId),
  index("idx_interviews_status").on(table.status),
  index("idx_interviews_date").on(table.interviewDate),
]);

// Next Step Comments table
export const nextStepComments = pgTable("next_step_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requirementId: varchar("requirement_id").notNull().references(() => requirements.id, { onDelete: 'cascade' }),
  comment: text("comment").notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_next_step_comments_requirement_id").on(table.requirementId),
  index("idx_next_step_comments_created_by").on(table.createdBy),
  index("idx_next_step_comments_created_at").on(table.createdAt),
]);

// Email threads table
export const emailThreads = pgTable("email_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: varchar("subject").notNull(),
  participantEmails: text("participant_emails").array().notNull(), // Array of email addresses
  lastMessageAt: timestamp("last_message_at"),
  messageCount: integer("message_count").notNull().default(0),
  isArchived: boolean("is_archived").default(false),
  labels: text("labels").array().notNull().default(sql`'{}'`), // Array of label strings
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_email_threads_created_by").on(table.createdBy),
  index("idx_email_threads_last_message").on(table.lastMessageAt),
  index("idx_email_threads_user_archive").on(table.createdBy, table.isArchived),
]);

// Email messages table
export const emailMessages = pgTable("email_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => emailThreads.id, { onDelete: 'cascade' }),
  emailAccountId: varchar("email_account_id").references(() => emailAccounts.id, { onDelete: 'set null' }), // Link to email account
  externalMessageId: varchar("external_message_id"), // UID from IMAP or Gmail API
  fromEmail: varchar("from_email").notNull(),
  toEmails: text("to_emails").array().notNull(),
  ccEmails: text("cc_emails").array().notNull().default(sql`'{}'`),
  bccEmails: text("bcc_emails").array().notNull().default(sql`'{}'`),
  subject: varchar("subject").notNull(),
  htmlBody: text("html_body"),
  textBody: text("text_body"),
  messageType: varchar("message_type").notNull().default("received"), // sent, received, draft
  isRead: boolean("is_read").default(false),
  isStarred: boolean("is_starred").default(false),
  isImportant: boolean("is_important").default(false),
  sentAt: timestamp("sent_at"),
  externalFolder: varchar("external_folder"), // IMAP folder name
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_email_messages_thread_id").on(table.threadId),
  index("idx_email_messages_from_email").on(table.fromEmail),
  index("idx_email_messages_message_type").on(table.messageType),
  index("idx_email_messages_sent_at").on(table.sentAt),
  index("idx_email_messages_account_id").on(table.emailAccountId),
  index("idx_email_messages_external_id").on(table.externalMessageId),
  index("idx_email_messages_account_thread").on(table.emailAccountId, table.threadId),
]);

// Email attachments table
export const emailAttachments = pgTable("email_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => emailMessages.id, { onDelete: 'cascade' }),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type"),
  fileContent: text("file_content"), // Base64 encoded content
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_email_attachments_message_id").on(table.messageId),
]);

// Email accounts table for multi-account support
export const emailAccounts = pgTable("email_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountName: varchar("account_name").notNull(), // User-friendly name
  emailAddress: varchar("email_address").notNull(),
  provider: varchar("provider").notNull(), // 'gmail', 'outlook', 'smtp', 'imap'
  
  // OAuth2 fields (for Gmail, Outlook)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  
  // SMTP/IMAP configuration
  smtpHost: varchar("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure").default(true), // SSL/TLS
  imapHost: varchar("imap_host"),
  imapPort: integer("imap_port"),
  imapSecure: boolean("imap_secure").default(true),
  
  // Authentication
  username: varchar("username"), // For SMTP/IMAP auth
  password: text("password"), // Encrypted password for SMTP/IMAP
  
  // Account settings
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  syncEnabled: boolean("sync_enabled").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  syncFrequency: integer("sync_frequency").default(15), // seconds - ultra-fast sync
  historyId: varchar("history_id"), // Gmail History ID for incremental sync
  
  // Folder mapping
  inboxFolder: varchar("inbox_folder").default('INBOX'),
  sentFolder: varchar("sent_folder").default('SENT'),
  draftsFolder: varchar("drafts_folder").default('DRAFTS'),
  trashFolder: varchar("trash_folder").default('TRASH'),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_email_accounts_user_id").on(table.userId),
  index("idx_email_accounts_email").on(table.emailAddress),
  index("idx_email_accounts_provider").on(table.provider),
  index("idx_email_accounts_sync").on(table.userId, table.isActive, table.syncEnabled),
  uniqueIndex("uq_email_accounts_user_email").on(table.userId, table.emailAddress),
]);

// General attachments table for files across the system
export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: varchar("file_name").notNull(),
  filePath: varchar("file_path").notNull(), // Path on disk
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  entityType: varchar("entity_type").notNull(), // requirement, interview, email, general
  entityId: varchar("entity_id"), // ID of the related entity
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_attachments_entity").on(table.entityType, table.entityId),
  index("idx_attachments_uploaded_by").on(table.uploadedBy),
]);

// Add role field to users table for role-based access control
// This will be added via migration

// Relations for Marketing module
export const consultantsRelations = relations(consultants, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [consultants.createdBy],
    references: [users.id],
  }),
  projects: many(consultantProjects),
  requirements: many(requirements),
  interviews: many(interviews),
}));

export const consultantProjectsRelations = relations(consultantProjects, ({ one }) => ({
  consultant: one(consultants, {
    fields: [consultantProjects.consultantId],
    references: [consultants.id],
  }),
}));

export const requirementsRelations = relations(requirements, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [requirements.createdBy],
    references: [users.id],
  }),
  consultant: one(consultants, {
    fields: [requirements.consultantId],
    references: [consultants.id],
  }),
  interviews: many(interviews),
  nextStepComments: many(nextStepComments),
}));

export const interviewsRelations = relations(interviews, ({ one }) => ({
  requirement: one(requirements, {
    fields: [interviews.requirementId],
    references: [requirements.id],
  }),
  consultant: one(consultants, {
    fields: [interviews.consultantId],
    references: [consultants.id],
  }),
  marketingPerson: one(users, {
    fields: [interviews.marketingPersonId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [interviews.createdBy],
    references: [users.id],
  }),
}));

export const nextStepCommentsRelations = relations(nextStepComments, ({ one }) => ({
  requirement: one(requirements, {
    fields: [nextStepComments.requirementId],
    references: [requirements.id],
  }),
  createdByUser: one(users, {
    fields: [nextStepComments.createdBy],
    references: [users.id],
  }),
}));

export const emailThreadsRelations = relations(emailThreads, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [emailThreads.createdBy],
    references: [users.id],
  }),
  messages: many(emailMessages),
}));

export const emailAccountsRelations = relations(emailAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [emailAccounts.userId],
    references: [users.id],
  }),
  messages: many(emailMessages),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one, many }) => ({
  thread: one(emailThreads, {
    fields: [emailMessages.threadId],
    references: [emailThreads.id],
  }),
  emailAccount: one(emailAccounts, {
    fields: [emailMessages.emailAccountId],
    references: [emailAccounts.id],
  }),
  createdByUser: one(users, {
    fields: [emailMessages.createdBy],
    references: [users.id],
  }),
  attachments: many(emailAttachments),
}));

export const emailAttachmentsRelations = relations(emailAttachments, ({ one }) => ({
  message: one(emailMessages, {
    fields: [emailAttachments.messageId],
    references: [emailMessages.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  uploadedByUser: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}));

// Insert schemas for Marketing module
export const insertConsultantSchema = createInsertSchema(consultants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsultantProjectSchema = createInsertSchema(consultantProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRequirementSchema = createInsertSchema(requirements).omit({
  id: true,
  requirementEnteredDate: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInterviewSchema = createInsertSchema(interviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNextStepCommentSchema = createInsertSchema(nextStepComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailThreadSchema = createInsertSchema(emailThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailMessageSchema = createInsertSchema(emailMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailAttachmentSchema = createInsertSchema(emailAttachments).omit({
  id: true,
  createdAt: true,
});

export const insertEmailAccountSchema = createInsertSchema(emailAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Audit Logs table
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: varchar("action").notNull(), // CREATE, UPDATE, DELETE, VIEW
  entityType: varchar("entity_type").notNull(), // requirement, consultant, interview, etc.
  entityId: varchar("entity_id").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_logs_user_id").on(table.userId),
  index("idx_audit_logs_entity").on(table.entityType, table.entityId),
  index("idx_audit_logs_created_at").on(table.createdAt),
]);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const loginHistoryRelations = relations(loginHistory, ({ one }) => ({
  user: one(users, {
    fields: [loginHistory.userId],
    references: [users.id],
  }),
}));

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type InsertResume = z.infer<typeof insertResumeSchema>;
export type TechStack = typeof techStacks.$inferSelect;
export type InsertTechStack = z.infer<typeof insertTechStackSchema>;
export type PointGroup = typeof pointGroups.$inferSelect;
export type InsertPointGroup = z.infer<typeof insertPointGroupSchema>;
export type ProcessingHistory = typeof processingHistory.$inferSelect;
export type InsertProcessingHistory = z.infer<typeof insertProcessingHistorySchema>;

// Point structure for groups
export type Point = {
  techStack: string;
  text: string;
};

// Marketing module types
export type Consultant = typeof consultants.$inferSelect;
export type InsertConsultant = z.infer<typeof insertConsultantSchema>;
export type ConsultantProject = typeof consultantProjects.$inferSelect;
export type InsertConsultantProject = z.infer<typeof insertConsultantProjectSchema>;
export type Requirement = typeof requirements.$inferSelect;
export type InsertRequirement = z.infer<typeof insertRequirementSchema>;
export type Interview = typeof interviews.$inferSelect;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type NextStepComment = typeof nextStepComments.$inferSelect;
export type InsertNextStepComment = z.infer<typeof insertNextStepCommentSchema>;
export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type EmailAttachment = typeof emailAttachments.$inferSelect;
export type InsertEmailAttachment = z.infer<typeof insertEmailAttachmentSchema>;
export type EmailAccount = typeof emailAccounts.$inferSelect;
export type InsertEmailAccount = z.infer<typeof insertEmailAccountSchema>;
export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;

// Marketing comment structure
export type MarketingComment = {
  comment: string;
  timestamp: Date;
  userId: string;
  userName?: string;
};

// Requirement status enum
export const RequirementStatus = {
  NEW: 'New',
  WORKING: 'Working',
  APPLIED: 'Applied',
  SUBMITTED: 'Submitted',
  INTERVIEWED: 'Interviewed',
  CANCELLED: 'Cancelled'
} as const;

// Interview status enum
export const InterviewStatus = {
  ALL: 'All',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Re-Scheduled',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed'
} as const;

// Consultant status enum
export const ConsultantStatus = {
  ACTIVE: 'Active',
  NOT_ACTIVE: 'Not Active'
} as const;

// Timezone enum
export const Timezones = {
  EST: 'EST',
  CST: 'CST',
  MST: 'MST',
  PST: 'PST'
} as const;

// RBAC - User Roles
export const UserRole = {
  USER: 'user',
  MARKETING: 'marketing',
  ADMIN: 'admin'
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// RBAC - Permission definitions
export const Permissions = {
  // User permissions
  MANAGE_OWN_RESUMES: 'manage_own_resumes',
  PROCESS_TECH_STACKS: 'process_tech_stacks',
  UPLOAD_DOCUMENTS: 'upload_documents',
  
  // Marketing permissions
  ACCESS_MARKETING: 'access_marketing',
  MANAGE_CONSULTANTS: 'manage_consultants',
  MANAGE_REQUIREMENTS: 'manage_requirements',
  MANAGE_INTERVIEWS: 'manage_interviews',
  SEND_EMAILS: 'send_emails',
  
  // Admin permissions
  MANAGE_USERS: 'manage_users',
  ASSIGN_ROLES: 'assign_roles',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  SYSTEM_CONFIG: 'system_config',
  ACCESS_ALL_DATA: 'access_all_data'
} as const;

export type PermissionType = typeof Permissions[keyof typeof Permissions];

// Role to permissions mapping
export const RolePermissions: Record<UserRoleType, PermissionType[]> = {
  [UserRole.USER]: [
    Permissions.MANAGE_OWN_RESUMES,
    Permissions.PROCESS_TECH_STACKS,
    Permissions.UPLOAD_DOCUMENTS
  ],
  [UserRole.MARKETING]: [
    Permissions.MANAGE_OWN_RESUMES,
    Permissions.PROCESS_TECH_STACKS,
    Permissions.UPLOAD_DOCUMENTS,
    Permissions.ACCESS_MARKETING,
    Permissions.MANAGE_CONSULTANTS,
    Permissions.MANAGE_REQUIREMENTS,
    Permissions.MANAGE_INTERVIEWS,
    Permissions.SEND_EMAILS
  ],
  [UserRole.ADMIN]: [
    Permissions.MANAGE_OWN_RESUMES,
    Permissions.PROCESS_TECH_STACKS,
    Permissions.UPLOAD_DOCUMENTS,
    Permissions.ACCESS_MARKETING,
    Permissions.MANAGE_CONSULTANTS,
    Permissions.MANAGE_REQUIREMENTS,
    Permissions.MANAGE_INTERVIEWS,
    Permissions.SEND_EMAILS,
    Permissions.MANAGE_USERS,
    Permissions.ASSIGN_ROLES,
    Permissions.VIEW_AUDIT_LOGS,
    Permissions.SYSTEM_CONFIG,
    Permissions.ACCESS_ALL_DATA
  ]
};

// Approval Status enum
export const ApprovalStatus = {
  PENDING_VERIFICATION: 'pending_verification',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const;

export type ApprovalStatusType = typeof ApprovalStatus[keyof typeof ApprovalStatus];

// Types for login history
export type LoginHistory = typeof loginHistory.$inferSelect;
export type InsertLoginHistory = typeof loginHistory.$inferInsert;
