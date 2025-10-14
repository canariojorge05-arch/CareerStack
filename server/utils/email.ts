import nodemailer, { TransportOptions } from 'nodemailer';
import { google } from 'googleapis';
import { config } from 'dotenv';
import { logger } from './logger';

config();

interface EmailTemplate {
  subject: string;
  html: string;
}

interface EmailTemplates {
  verifyEmail: (name: string, verificationLink: string) => EmailTemplate;
  welcomeEmail: (name: string) => EmailTemplate;
  resetPassword: (name: string, resetLink: string) => EmailTemplate;
  twoFactorCode: (name: string, code: string) => EmailTemplate;
}

const OAuth2 = google.auth.OAuth2;

interface OAuthConfig {
  type: 'OAuth2';
  user: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
}

interface GmailTransportConfig extends TransportOptions {
  auth: OAuthConfig;
}

const getAccessToken = async (oauth2Client: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    oauth2Client.getAccessToken((err: Error | null, token: string | null | undefined) => {
      if (err) {
        reject(new Error('Failed to create access token: ' + err.message));
        return;
      }
      if (!token) {
        reject(new Error('Access token is null'));
        return;
      }
      resolve(token);
    });
  });
};

const createTransporter = async () => {
  try {
    // If Gmail API is not configured, check EMAIL_PROVIDER and fall back to regular SMTP
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();

    // If Gmail API is not configured, fall back to regular SMTP
    if (!process.env.GMAIL_CLIENT_ID) {
      const smtpConfig = {
        service: process.env.EMAIL_SERVICE || 'gmail',
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER || '',
          // Common pitfall: some providers (e.g., Gmail app passwords) are copied with spaces
          pass: (process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '')
        }
      } as TransportOptions;
      return nodemailer.createTransport(smtpConfig);
    }

    if (!process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
      throw new Error('Missing Gmail configuration');
    }

    const oauth2Client = new OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    const accessToken = await getAccessToken(oauth2Client);

    const transportConfig: GmailTransportConfig = {
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER || '',
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: accessToken
      }
    } as GmailTransportConfig;
  
    return nodemailer.createTransport(transportConfig);
  } catch (error) {
    logger.error({ error: error }, 'Error creating transporter:');
    throw error;
  }
};

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: EmailAttachment[],
  options?: {
    replyTo?: string;
    priority?: 'high' | 'normal' | 'low';
    category?: string;
  }
): Promise<boolean> {
  try {
    const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
    let transporter = await createTransporter();
    let triedFallback = false;
    
    // Build a safe "from" header
    const envFrom = (process.env.EMAIL_FROM || '').trim();
    const defaultFrom = process.env.EMAIL_USER ? `"Resume Customizer Pro" <${process.env.EMAIL_USER}>` : undefined;
    const fromHeader = envFrom
      ? (envFrom.includes('<') ? envFrom : `"Resume Customizer Pro" <${envFrom}>`)
      : (defaultFrom || 'no-reply@example.com');

    // Extract domain for Message-ID
    const domain = process.env.EMAIL_DOMAIN || 'resumecustomizerpro.com';
    const messageId = `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@${domain}>`;

    logger.info(`📧 Preparing to send email to: ${to}`);
    logger.info(`📧 From: ${fromHeader}`);
    logger.info(`📧 Subject: ${subject}`);
    logger.info(`📧 Message-ID: ${messageId}`);

    // Create clean text version
    const textContent = html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const mailOptions = {
      from: fromHeader,
      to,
      subject,
      html,
      text: textContent,
      messageId: messageId,
      
      // Anti-spam headers
      headers: {
        'X-Mailer': 'Resume Customizer Pro v1.0',
        'X-Priority': options?.priority === 'high' ? '1' : options?.priority === 'low' ? '5' : '3',
        'X-MSMail-Priority': options?.priority === 'high' ? 'High' : options?.priority === 'low' ? 'Low' : 'Normal',
        'Importance': options?.priority === 'high' ? 'high' : options?.priority === 'low' ? 'low' : 'normal',
        'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
        'List-Unsubscribe': `<mailto:unsubscribe@${domain}>`,
        'X-Entity-ID': `resume-customizer-pro-${Date.now()}`,
        'Return-Path': fromHeader.includes('<') ? fromHeader.match(/<(.+)>/)?.[1] : fromHeader,
        ...(options?.category && { 'X-Category': options.category }),
        
        // Authentication headers (these will be added by your email provider if configured)
        'Authentication-Results': `${domain}; spf=pass; dkim=pass; dmarc=pass`,
      },
      
      // Reply-to header
      ...(options?.replyTo && { replyTo: options.replyTo }),
      
      // Attachments
      attachments: attachments?.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType
      })),
      
      // Additional options for better deliverability
        envelope: {
          from: fromHeader.includes('<') ? fromHeader.match(/<(.+)>/)?.[1] : fromHeader,
          to: to
        }
      } as any;

    try {
      const info = await transporter.sendMail(mailOptions);
      logger.info(`✅ Email sent successfully! Message ID: ${info.messageId}`);
      logger.info(`📧 Email details - To: ${to}, Subject: ${subject}`);
      logger.info(`📧 Accepted: ${info.accepted?.length || 0}, Rejected: ${info.rejected?.length || 0}`);
      return true;
    } catch (primaryError) {
      logger.error(`❌ Primary email provider failed (${provider}):`, primaryError);
      // Try a simple fallback to generic SMTP credentials if available
      try {
        const fallbackSmtp = {
          host: process.env.EMAIL_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.EMAIL_PORT || '587'),
          secure: process.env.EMAIL_SECURE === 'true',
          auth: {
            user: process.env.EMAIL_USER || '',
            pass: (process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '')
          }
        } as TransportOptions;
        logger.info('🔁 Attempting fallback send via generic SMTP settings...');
        transporter = nodemailer.createTransport(fallbackSmtp);
        const info2 = await transporter.sendMail(mailOptions);
        logger.info(`✅ Fallback email sent successfully! Message ID: ${info2.messageId}`);
        logger.info(`📧 Email details - To: ${to}, Subject: ${subject}`);
        logger.info(`📧 Accepted: ${info2.accepted?.length || 0}, Rejected: ${info2.rejected?.length || 0}`);
        return true;
      } catch (fallbackError) {
        logger.error({ error: fallbackError }, '❌ Fallback SMTP send failed:');
        throw primaryError;
      }
    }
    
  } catch (error) {
    logger.error(`❌ Failed to send email to ${to}:`, error);
    logger.error(`📧 Email subject: ${subject}`);
    
    // Log specific error details
    if (error instanceof Error) {
      logger.error(`📧 Error message: ${error.message}`);
      logger.error(`📧 Error stack: ${error.stack}`);
    }
    return false;
  }
}

export const emailTemplates = {
  verification: (name: string, verificationLink: string) => ({
    subject: 'Please verify your Resume Customizer Pro account',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          .email-container { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background-color: #ffffff; }
          .button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
          .link-fallback { background-color: #f8f9fa; padding: 15px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px; margin: 20px 0; }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5;">
        <div class="email-container" style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">Resume Customizer Pro</h1>
          </div>
          
          <div class="content">
            <h2 style="color: #333; margin-bottom: 20px;">Welcome to Resume Customizer Pro!</h2>
            <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">Hello ${name},</p>
            <p style="color: #555; line-height: 1.6; margin-bottom: 25px;">
              Thank you for creating your Resume Customizer Pro account. To get started, please verify your email address by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" class="button">Verify My Email Address</a>
            </div>
            
            <p style="color: #555; line-height: 1.6; margin-bottom: 15px;">
              If the button above doesn't work, you can copy and paste this link into your browser:
            </p>
            <div class="link-fallback">${verificationLink}</div>
            
            <p style="color: #666; line-height: 1.6; font-size: 14px;">
              If you didn't create an account with Resume Customizer Pro, you can safely ignore this email.
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 0;">Best regards,<br><strong>The Resume Customizer Pro Team</strong></p>
            <p style="margin: 10px 0 0 0;">This email was sent to verify your account. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
  
  passwordReset: (name: string, resetLink: string) => ({
    subject: 'Reset Your Resume Customizer Pro Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; margin-top: 20px;">
          <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #4CAF50;">
            <h1 style="color: #4CAF50; margin: 0;">Resume Customizer Pro</h1>
          </div>
          
          <div style="padding: 30px 0;">
            <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
            <p style="color: #666; line-height: 1.6;">Hello ${name},</p>
            <p style="color: #666; line-height: 1.6;">
              We received a request to reset your password for your Resume Customizer Pro account. 
              If you made this request, click the button below to set a new password:
            </p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${resetLink}" 
                 style="background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Reset My Password
              </a>
            </div>
            
            <p style="color: #666; line-height: 1.6;">
              If the button above doesn't work, copy and paste this link into your browser:
            </p>
            <p style="background-color: #f8f8f8; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px;">
              ${resetLink}
            </p>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour for your security.
              </p>
            </div>
            
            <p style="color: #666; line-height: 1.6;">
              If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
              If you're concerned about your account security, please contact our support team.
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>Best regards,<br><strong>The Resume Customizer Pro Team</strong></p>
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
  
  twoFactorCode: (name: string, code: string) => ({
    subject: 'Your Two-Factor Authentication Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Verification Code</h2>
        <p>Hello ${name},</p>
        <p>Your two-factor authentication code is:</p>
        <h1 style="text-align: center; font-size: 32px; letter-spacing: 5px; margin: 20px 0;">${code}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please secure your account immediately.</p>
        <p>Best regards,<br>The Resume Customizer Pro Team</p>
      </div>
    `,
  }),
};
