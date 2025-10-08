import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  webViewLink?: string;
}

export interface GoogleDriveAuthStatus {
  authenticated: boolean;
  expiresAt?: number;
  needsRefresh?: boolean;
  googleDriveEmail?: string | null;
}

export interface UseGoogleDriveReturn {
  // Authentication
  authStatus: GoogleDriveAuthStatus | null;
  isCheckingAuth: boolean;
  authenticateWithGoogle: () => Promise<void>;
  revokeAccess: () => Promise<void>;
  
  // File operations
  files: GoogleDriveFile[];
  isLoadingFiles: boolean;
  loadFiles: () => Promise<void>;
  downloadAndProcessFile: (fileId: string, fileName: string) => Promise<any>;
  isProcessingFile: boolean;
  
  // Pagination
  hasMoreFiles: boolean;
  loadMoreFiles: () => Promise<void>;
}

export function useGoogleDrive(): UseGoogleDriveReturn {
  const [authStatus, setAuthStatus] = useState<GoogleDriveAuthStatus | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [hasMoreFiles, setHasMoreFiles] = useState(false);

  /**
   * Check current authentication status
   */
  const checkAuthStatus = useCallback(async () => {
    setIsCheckingAuth(true);
    try {
      const response = await fetch('/api/google-drive/auth-status', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const status = await response.json();
        setAuthStatus(status);
      } else {
        setAuthStatus({ authenticated: false });
      }
    } catch (error) {
      console.error('Failed to check Google Drive auth status:', error);
      setAuthStatus({ authenticated: false });
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  /**
   * Authenticate with Google Drive
   */
  const authenticateWithGoogle = useCallback(async () => {
    try {
      // Get auth URL from backend
      const response = await fetch('/api/google-drive/auth-url', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to get authentication URL');
      }
      
      const { authUrl } = await response.json();
      
      // Open popup for Google OAuth
      const popup = window.open(
        authUrl,
        'google-drive-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
      
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
      
      // Listen for the popup to close or send a message
      return new Promise<void>((resolve, reject) => {
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            // Check auth status after popup closes
            checkAuthStatus().then(() => {
              if (authStatus?.authenticated) {
                toast.success('Successfully connected to Google Drive!');
                resolve();
              } else {
                reject(new Error('Authentication was cancelled or failed'));
              }
            });
          }
        }, 1000);
        
        // Listen for messages from popup (if using postMessage)
        const messageListener = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'GOOGLE_DRIVE_AUTH_SUCCESS') {
            clearInterval(checkClosed);
            popup.close();
            window.removeEventListener('message', messageListener);
            
            // Send auth code to backend
              handleAuthCallback(event.data.code, event.data.state).then(() => {
              toast.success('Successfully connected to Google Drive!');
              resolve();
            }).catch(reject);
          } else if (event.data.type === 'GOOGLE_DRIVE_AUTH_ERROR') {
            clearInterval(checkClosed);
            popup.close();
            window.removeEventListener('message', messageListener);
            reject(new Error(event.data.error || 'Authentication failed'));
          }
        };
        
        window.addEventListener('message', messageListener);
        
        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          if (!popup.closed) {
            popup.close();
          }
          reject(new Error('Authentication timeout'));
        }, 5 * 60 * 1000);
      });
    } catch (error) {
      console.error('Google Drive authentication failed:', error);
      toast.error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [authStatus, checkAuthStatus]);

  /**
   * Handle auth callback from popup
   */
  const handleAuthCallback = useCallback(async (code: string, state?: string) => {
    try {
      const response = await fetch('/api/google-drive/auth-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, state })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Authentication failed');
      }
      
      await checkAuthStatus();
    } catch (error) {
      console.error('Auth callback failed:', error);
      throw error;
    }
  }, [checkAuthStatus]);

  /**
   * Revoke Google Drive access
   */
  const revokeAccess = useCallback(async () => {
    try {
      const response = await fetch('/api/google-drive/revoke-access', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to revoke access');
      }
      
      setAuthStatus({ authenticated: false });
      setFiles([]);
      setNextPageToken(undefined);
      setHasMoreFiles(false);
      
      toast.success('Google Drive access revoked successfully');
    } catch (error) {
      console.error('Failed to revoke Google Drive access:', error);
      toast.error('Failed to revoke access');
      throw error;
    }
  }, []);

  /**
   * Load files from Google Drive
   */
  const loadFiles = useCallback(async (pageToken?: string) => {
    if (!authStatus?.authenticated) {
      throw new Error('Not authenticated with Google Drive');
    }
    
    setIsLoadingFiles(true);
    try {
      const params = new URLSearchParams();
      if (pageToken) params.append('pageToken', pageToken);
      
      const response = await fetch(`/api/google-drive/files?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        if (error.needsAuth) {
          setAuthStatus({ authenticated: false });
          throw new Error('Authentication expired. Please reconnect to Google Drive.');
        }
        throw new Error(error.message || 'Failed to load files');
      }
      
      const data = await response.json();
      
      if (pageToken) {
        // Append to existing files (pagination)
        setFiles(prev => [...prev, ...data.files]);
      } else {
        // Replace files (initial load)
        setFiles(data.files);
      }
      
      setNextPageToken(data.nextPageToken);
      setHasMoreFiles(!!data.nextPageToken);
      
    } catch (error) {
      console.error('Failed to load Google Drive files:', error);
      toast.error(`Failed to load files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      setIsLoadingFiles(false);
    }
  }, [authStatus]);

  /**
   * Load more files (pagination)
   */
  const loadMoreFiles = useCallback(async () => {
    if (nextPageToken && !isLoadingFiles) {
      await loadFiles(nextPageToken);
    }
  }, [nextPageToken, isLoadingFiles, loadFiles]);

  /**
   * Download and process file from Google Drive
   */
  const downloadAndProcessFile = useCallback(async (fileId: string, fileName: string) => {
    if (!authStatus?.authenticated) {
      throw new Error('Not authenticated with Google Drive');
    }
    
    setIsProcessingFile(true);
    try {
      console.log(`🚀 Processing Google Drive file: ${fileName}`);
      
      const response = await fetch('/api/google-drive/download-and-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileId, fileName })
      });
      
      if (!response.ok) {
        const error = await response.json();
        if (error.needsAuth) {
          setAuthStatus({ authenticated: false });
          throw new Error('Authentication expired. Please reconnect to Google Drive.');
        }
        throw new Error(error.message || 'Failed to process file');
      }
      
      const result = await response.json();
      
      toast.success(`Successfully imported ${fileName} from Google Drive!`);
      console.log('✅ Google Drive file processed:', result);
      
      return result;
    } catch (error) {
      console.error('Failed to process Google Drive file:', error);
      toast.error(`Failed to process ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      setIsProcessingFile(false);
    }
  }, [authStatus]);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Auto-load files when authenticated
  useEffect(() => {
    if (authStatus?.authenticated && files.length === 0 && !isLoadingFiles) {
      loadFiles();
    }
  }, [authStatus, files.length, isLoadingFiles, loadFiles]);

  return {
    // Authentication
    authStatus,
    isCheckingAuth,
    authenticateWithGoogle,
    revokeAccess,
    
    // File operations
    files,
    isLoadingFiles,
    loadFiles: () => loadFiles(),
    downloadAndProcessFile,
    isProcessingFile,
    
    // Pagination
    hasMoreFiles,
    loadMoreFiles,
  };
}
