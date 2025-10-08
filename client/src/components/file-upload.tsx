import { useRef, useState, DragEvent, useMemo } from 'react';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload,
  X,
  FileText,
  AlertCircle,
  CheckCircle,
  Info,
  Lightbulb,
  Cloud,
  HardDrive,
} from 'lucide-react';
import { useFileValidation } from '@/hooks/useValidation';
import { validateFileUpload } from '@/lib/validation';
import GoogleDrivePicker from './google-drive-picker';

interface FileUploadProps {
  onUpload: (files: FileList) => void;
  onGoogleDriveUpload?: (resume: any) => void;
  isUploading?: boolean;
}

export default function FileUpload({
  onUpload,
  onGoogleDriveUpload,
  isUploading = false,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Create FileList from selected files for validation, memoized to avoid recreating on each render
  const fileList = useMemo(() => {
    if (selectedFiles.length === 0) return null;
    const dt = new DataTransfer();
    selectedFiles.forEach((file) => dt.items.add(file));
    return dt.files;
  }, [selectedFiles]);

  // Real-time validation
  const validation = useFileValidation(fileList);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0 && validation.isValid) {
      const fileList = new DataTransfer();
      selectedFiles.forEach((file) => fileList.items.add(file));

      // Faster simulated upload progress for better UX
      setUploadProgress(0);
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 80) {
            clearInterval(progressInterval);
            return 80; // Let the actual upload complete the progress
          }
          return prev + 20; // Faster progress updates
        });
      }, 50); // Faster interval

      onUpload(fileList.files);

      // Clear after successful upload trigger
      setTimeout(() => {
        setSelectedFiles([]);
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 1000);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleGoogleDriveUpload = (resume: any) => {
    if (onGoogleDriveUpload) {
      onGoogleDriveUpload(resume);
    }
  };

  // File type analysis for better UX
  const getFileTypeColor = (file: File) => {
    if (file.type.includes('word') || file.name.endsWith('.docx')) return 'text-blue-600';
    if (file.type.includes('pdf')) return 'text-red-600';
    return 'text-gray-600';
  };

  const getFileTypeIcon = (file: File) => {
    return <FileText className={getFileTypeColor(file)} size={20} />;
  };

  return (
    <div className="space-y-4">
      {/* Validation Status */}
      {validation.hasValidated && (
        <div className="space-y-2">
          {validation.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {validation.errors.map((error, index) => (
                    <div key={index} className="text-sm">
                      {error}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {validation.warnings.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <div key={index} className="text-sm">
                      {warning}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {validation.suggestions.length > 0 && (
            <Alert className="border-amber-200 bg-amber-50">
              <Lightbulb className="h-4 w-4 text-amber-600" />
              <AlertDescription>
                <div className="space-y-1">
                  {validation.suggestions.map((suggestion, index) => (
                    <div key={index} className="text-sm text-amber-800">
                      {suggestion}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && uploadProgress > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center space-x-2">
              <span>Uploading files...</span>
              {uploadProgress >= 80 && <span className="text-blue-600">Processing on server...</span>}
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="w-full" />
          {uploadProgress >= 80 && (
            <p className="text-xs text-muted-foreground">
              Files uploaded successfully. Processing may take a moment for large files.
            </p>
          )}
        </div>
      )}

      {/* Upload Options Tabs */}
      <Tabs defaultValue="local" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="local" className="flex items-center space-x-2">
            <HardDrive className="w-4 h-4" />
            <span>Local Files</span>
          </TabsTrigger>
          <TabsTrigger value="google-drive" className="flex items-center space-x-2">
            <Cloud className="w-4 h-4" />
            <span>Google Drive</span>
          </TabsTrigger>
        </TabsList>

        {/* Information banner removed for minimal UI */}

        <TabsContent value="local" className="mt-4">
          {/* Local File Upload */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-primary bg-primary/5 scale-105'
                : validation.hasValidated && !validation.isValid
                ? 'border-red-300 bg-red-50 hover:border-red-400'
                : validation.hasValidated && validation.isValid
                ? 'border-green-300 bg-green-50 hover:border-green-400'
                : 'border-border bg-gradient-to-br from-muted/30 to-muted/10 hover:border-primary hover:bg-primary/5'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={!isUploading ? triggerFileSelect : undefined}
            data-testid="file-upload-zone"
          >
            <div
              className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                validation.hasValidated && !validation.isValid
                  ? 'bg-red-100'
                  : validation.hasValidated && validation.isValid
                  ? 'bg-green-100'
                  : 'bg-primary/10'
              }`}
            >
              {validation.hasValidated && !validation.isValid ? (
                <AlertCircle className="text-red-600" size={24} />
              ) : validation.hasValidated && validation.isValid ? (
                <CheckCircle className="text-green-600" size={24} />
              ) : (
                <Upload className="text-primary" size={24} />
              )}
            </div>
            <h4 className="text-lg font-medium text-foreground mb-2">
              {selectedFiles.length > 0
                ? `${selectedFiles.length} file(s) selected`
                : 'Upload from Your Computer'}
            </h4>
            <p className="text-muted-foreground mb-4">
              {selectedFiles.length > 0
                ? 'Files ready to upload from your local computer'
                : 'Drag & drop DOCX files here or click to browse your computer'}
            </p>
            <LoadingButton
              type="button"
              loading={isUploading}
              loadingText={uploadProgress >= 80 ? 'Processing on server...' : 'Uploading files...'}
              className={`${
                validation.hasValidated && !validation.isValid
                  ? 'bg-red-600 hover:bg-red-700'
                  : validation.hasValidated && validation.isValid
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-primary hover:bg-primary/90'
              }`}
              data-testid="button-select-files"
            >
              <HardDrive className="w-4 h-4 mr-2" />
              Select Files
            </LoadingButton>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".docx,.doc,.pdf"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-file"
            />
            <p className="text-xs text-muted-foreground mt-4">
              Supports DOCX, DOC, and PDF files up to 50MB each
              <br />
              Maximum 10 files per upload, 100MB total
            </p>
          </div>
        </TabsContent>

        <TabsContent value="google-drive" className="mt-4">
          {/* Google Drive Upload */}
          <div className="border-2 border-dashed border-blue-200 rounded-xl p-8 text-center bg-gradient-to-br from-blue-50/30 to-indigo-50/10">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Cloud className="text-blue-600" size={24} />
            </div>
            <h4 className="text-lg font-medium text-foreground mb-2">Import from Google Drive</h4>
            <p className="text-muted-foreground mb-4">
              Access your DOCX files stored in Google Drive without downloading them first
            </p>

            {/* Benefits list removed for minimal UI */}

            <GoogleDrivePicker onFileSelected={handleGoogleDriveUpload} disabled={isUploading} />

            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-800">
                🔒 <strong>Secure & Private:</strong> We only request read-only access to your DOCX
                files.
                <br />
                Your Google account stays secure and we never store your Google credentials.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">Selected Files:</h4>
            {validation.hasValidated && (
              <Badge
                className={
                  validation.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }
              >
                {validation.isValid ? (
                  <>
                    <CheckCircle size={12} className="mr-1" />
                    Valid
                  </>
                ) : (
                  <>
                    <AlertCircle size={12} className="mr-1" />
                    Invalid
                  </>
                )}
              </Badge>
            )}
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectedFiles.map((file, index) => {
              // Individual file validation
              const fileValidation = validateFileUpload(
                (() => {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  return dt.files;
                })()
              );

              return (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    fileValidation.isValid
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                  data-testid={`selected-file-${index}`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {getFileTypeIcon(file)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{file.name}</p>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                        <span>•</span>
                        <span>{file.type || 'Unknown type'}</span>
                        {!fileValidation.isValid && (
                          <>
                            <span>•</span>
                            <span className="text-red-600 font-medium">Issues detected</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {fileValidation.isValid ? (
                      <CheckCircle className="text-green-600" size={16} />
                    ) : (
                      <AlertCircle className="text-red-600" size={16} />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      data-testid={`button-remove-${index}`}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* File Summary */}
          <div className="p-3 bg-muted/20 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total files:</span>
              <span className="font-medium">{selectedFiles.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total size:</span>
              <span className="font-medium">
                {(selectedFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1)}{' '}
                MB
              </span>
            </div>
            {validation.hasValidated && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span
                  className={`font-medium ${
                    validation.isValid ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {validation.isValid ? 'Ready to upload' : 'Issues need attention'}
                </span>
              </div>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={isUploading || !validation.isValid}
            className={`w-full ${
              validation.isValid
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-400 hover:bg-gray-500 cursor-not-allowed'
            }`}
            data-testid="button-upload"
          >
            {isUploading
              ? uploadProgress >= 80
                ? 'Processing on server...'
                : `Uploading... ${uploadProgress}%`
              : validation.isValid
              ? `Upload ${selectedFiles.length} file(s)`
              : 'Fix issues to upload'}
          </Button>
        </div>
      )}
    </div>
  );
}
