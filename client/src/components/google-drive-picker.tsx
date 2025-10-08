import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Cloud,
  FileText,
  Download,
  Calendar,
  HardDrive,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  LogOut,
  Eye,
  Info,
} from 'lucide-react';
import { useGoogleDrive, type GoogleDriveFile } from '@/hooks/useGoogleDrive';
import { toast } from 'sonner';

interface GoogleDrivePickerProps {
  onFileSelected?: (resume: any) => void;
  disabled?: boolean;
}

export default function GoogleDrivePicker({ onFileSelected, disabled }: GoogleDrivePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null);

  const {
    authStatus,
    isCheckingAuth,
    authenticateWithGoogle,
    revokeAccess,
    files,
    isLoadingFiles,
    loadFiles,
    downloadAndProcessFile,
    isProcessingFile,
    hasMoreFiles,
    loadMoreFiles,
  } = useGoogleDrive();

  const handleAuthenticate = useCallback(async () => {
    try {
      await authenticateWithGoogle();
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  }, [authenticateWithGoogle]);

  const handleFileSelect = useCallback(
    async (file: GoogleDriveFile) => {
      try {
        setSelectedFile(file);
        const result = await downloadAndProcessFile(file.id, file.name);

        if (onFileSelected) {
          onFileSelected(result.resume);
        }

        setIsOpen(false);
        setSelectedFile(null);
      } catch (error) {
        console.error('File selection failed:', error);
        setSelectedFile(null);
      }
    },
    [downloadAndProcessFile, onFileSelected]
  );

  const handleRevoke = useCallback(async () => {
    try {
      await revokeAccess();
    } catch (error) {
      console.error('Failed to revoke access:', error);
    }
  }, [revokeAccess]);

  const formatFileSize = (sizeStr?: string) => {
    if (!sizeStr) return 'Unknown size';
    const size = parseInt(sizeStr);
    if (size < 1024 * 1024) {
      return `${Math.round(size / 1024)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown date';
    return new Date(dateStr).toLocaleDateString();
  };

  const renderAuthenticationView = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Cloud className="w-16 h-16 text-blue-500 mb-4" />
      <h3 className="text-lg font-semibold mb-2">Connect to Google Drive</h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        Connect your Google Drive to import DOCX files.
      </p>

      <LoadingButton
        onClick={handleAuthenticate}
        loading={isCheckingAuth}
        loadingText="Connecting..."
        className="bg-blue-600 hover:bg-blue-700"
      >
        <Cloud className="w-4 h-4 mr-2" />
        Connect Google Drive
      </LoadingButton>
      {/* Minimal UI: no extra banners or long explanations */}
    </div>
  );

  const renderFilesView = () => (
    <div className="space-y-4">
      {/* Header with auth status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <div className="text-sm font-medium text-green-800">
            <div>Connected to Google Drive</div>
            {authStatus?.googleDriveEmail && (
              <div className="text-xs text-green-700">{authStatus.googleDriveEmail}</div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadFiles()}
            disabled={isLoadingFiles}
            aria-label="Refresh Google Drive file list"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevoke}
            className="text-red-600 hover:text-red-700"
            aria-label="Disconnect Google Drive"
            title="Disconnect"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Files list */}
      {isLoadingFiles && files.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-muted-foreground">Loading your DOCX files...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No DOCX Files Found</h3>
          <p className="text-muted-foreground max-w-md">
            No DOCX files were found in your Google Drive. Upload some resume files to get started.
          </p>
        </div>
      ) : (
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {files.map((file) => (
              <Card
                key={file.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedFile?.id === file.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                } ${isProcessingFile && selectedFile?.id === file.id ? 'opacity-50' : ''}`}
                onClick={() => !isProcessingFile && handleFileSelect(file)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {isProcessingFile && selectedFile?.id === file.id ? (
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      ) : (
                        <FileText className="w-8 h-8 text-blue-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{file.name}</h4>
                      <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <HardDrive className="w-3 h-3" />
                          <span>{formatFileSize(file.size)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(file.modifiedTime)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {file.webViewLink && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(file.webViewLink, '_blank');
                          }}
                          className="p-1 h-auto"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}

                      <Badge variant="outline" className="text-xs">
                        DOCX
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Load more button */}
            {hasMoreFiles && (
              <div className="pt-4">
                <Button
                  variant="outline"
                  onClick={loadMoreFiles}
                  disabled={isLoadingFiles}
                  className="w-full"
                >
                  {isLoadingFiles ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading more files...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Load More Files
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center justify-center space-x-2 w-full">
        <DialogTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-indigo-100 flex items-center"
            aria-label="Import from Google Drive"
          >
            <Cloud className="w-4 h-4 mr-2" />
            Import from Google Drive
            {authStatus?.googleDriveEmail && (
              <span className="ml-3 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                {authStatus.googleDriveEmail}
              </span>
            )}
          </Button>
        </DialogTrigger>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="p-2 rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              aria-label="How Google Drive import works"
            >
              <Info className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="max-w-xs text-xs leading-relaxed">
              How it works:
              1) Connect once with Google,
              2) Browse your DOCX files,
              3) Click a file to import. You can disconnect anytime.
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Cloud className="w-5 h-5 text-blue-600" />
            <span>Google Drive File Picker</span>
          </DialogTitle>
          <DialogDescription>
            Select a DOCX file from your Google Drive to import and customize.
          </DialogDescription>
        </DialogHeader>

        {isCheckingAuth ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-muted-foreground">Checking connection...</span>
          </div>
        ) : authStatus?.authenticated ? (
          renderFilesView()
        ) : (
          renderAuthenticationView()
        )}

        {/* Processing status */}
        {isProcessingFile && selectedFile && (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={async (e) => {
                e.stopPropagation();
                // Switch account: revoke then open auth flow
                try {
                  await handleRevoke();
                  await handleAuthenticate();
                } catch (err) {
                  console.error('Switch account failed', err);
                }
              }}
              className="text-yellow-600 hover:text-yellow-700"
              title="Switch Google account"
            >
              Switch
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevoke}
              className="text-red-600 hover:text-red-700"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
