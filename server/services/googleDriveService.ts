import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';
import { logger } from '../utils/logger';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  webViewLink?: string;
}

export interface GoogleDriveAuthResult {
  accessToken: string;
  refreshToken?: string | null;
  expiryDate?: number | null;
  email?: string | null;
}

export class GoogleDriveService {
  private oauth2Client: OAuth2Client;
  private drive: any;

  constructor() {
    // Initialize OAuth2 client with credentials from environment
    // Default redirect URI points to a client-side callback page that posts the
    // authorization code back to the opener (client/public/google-drive-callback.html).
    // Allow override via GOOGLE_REDIRECT_URI in environment.
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const normalizedAppUrl = appUrl.replace(/\/$/, '');
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${normalizedAppUrl}/google-drive-callback.html`;

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Generate Google OAuth URL for authentication
   */
  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'select_account consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string): Promise<GoogleDriveAuthResult> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      // Immediately set credentials so the client can be used right away
      this.oauth2Client.setCredentials(tokens as any);
      
      // Attempt to retrieve the user's profile email
      let email: string | undefined;
      try {
        const oauth2 = google.oauth2({ auth: this.oauth2Client, version: 'v2' });
        const resp = await oauth2.userinfo.get();
        email = resp.data.email as string | undefined;
      } catch (e) {
        // ignore; email is optional but helpful to persist
      }

      return {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        email
      } as any;
    } catch (error) {
      logger.error({ error: error }, 'Failed to get tokens:');
      throw new Error('Failed to authenticate with Google Drive');
    }
  }

  /**
   * Set credentials for the OAuth2 client
   */
  setCredentials(tokens: GoogleDriveAuthResult): void {
    this.oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiryDate
    });
  }

  /**
   * List DOCX files from user's Google Drive
   */
  async listDocxFiles(pageSize: number = 20, pageToken?: string): Promise<{
    files: GoogleDriveFile[];
    nextPageToken?: string;
  }> {
    try {
      const query = "mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' and trashed=false";
      
      const response = await this.drive.files.list({
        q: query,
        pageSize,
        pageToken,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink)',
        orderBy: 'modifiedTime desc'
      });

      const files: GoogleDriveFile[] = response.data.files || [];
      
      return {
        files,
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      logger.error({ error: error }, 'Failed to list Drive files:');
      throw new Error('Failed to fetch files from Google Drive');
    }
  }

  /**
   * Get file metadata from Google Drive
   */
  async getFileMetadata(fileId: string): Promise<GoogleDriveFile> {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink'
      });

      return response.data;
    } catch (error) {
      logger.error({ error: error }, 'Failed to get file metadata:');
      throw new Error('Failed to get file information from Google Drive');
    }
  }

  /**
   * Download file content from Google Drive
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      logger.info(`📥 Downloading file from Google Drive: ${fileId}`);
      
      const response = await this.drive.files.get({
        fileId,
        alt: 'media'
      }, {
        responseType: 'stream'
      });

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      const stream = response.data as Readable;
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          logger.info(`✅ Downloaded ${buffer.length} bytes from Google Drive`);
          resolve(buffer);
        });
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error({ error: error }, 'Failed to download file from Drive:');
      throw new Error('Failed to download file from Google Drive');
    }
  }

  /**
   * Validate if file is a DOCX document
   */
  async validateDocxFile(fileId: string): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata(fileId);
      return metadata.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } catch (error) {
      logger.error({ error: error }, 'Failed to validate file:');
      return false;
    }
  }

  /**
   * Refresh access token if needed
   */
  async refreshAccessToken(): Promise<void> {
    try {
      // getAccessToken will trigger a refresh if a refresh_token is available
      const access = await this.oauth2Client.getAccessToken();
      if (!access || !access.token) {
        throw new Error('No access token returned');
      }
      // Update internal credentials expiry if available
      const creds: any = this.oauth2Client.credentials || {};
      creds.access_token = access.token;
      // expiry_date is not always provided by getAccessToken; leave unchanged if missing
      if (access.res && access.res.data && access.res.data.expires_in) {
        creds.expiry_date = Date.now() + access.res.data.expires_in * 1000;
      }
      this.oauth2Client.setCredentials(creds);
      return;
    } catch (error) {
      logger.error({ error: error }, 'Failed to refresh access token:');
      throw new Error('Failed to refresh Google Drive access');
    }
  }
}

export default GoogleDriveService;
