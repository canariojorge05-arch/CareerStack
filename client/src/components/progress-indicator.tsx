import { useState, useEffect } from 'react';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Download,
  FileText,
  Upload,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

interface ProgressIndicatorProps {
  show: boolean;
  progress: number;
  status: string;
  type: 'upload' | 'export' | 'batch' | 'save';
  onCancel?: () => void;
  onComplete?: (result?: any) => void;
  onDownload?: () => void;
  error?: string;
  result?: any;
  className?: string;
}

const typeConfig = {
  upload: {
    icon: Upload,
    color: 'blue',
    title: 'Uploading Document'
  },
  export: {
    icon: Download,
    color: 'green',
    title: 'Exporting Document'
  },
  batch: {
    icon: FileText,
    color: 'orange',
    title: 'Processing Multiple Files'
  },
  save: {
    icon: CheckCircle,
    color: 'blue',
    title: 'Saving Document'
  }
};

export function ProgressIndicator({
  show,
  progress,
  status,
  type,
  onCancel,
  onComplete,
  onDownload,
  error,
  result,
  className = ''
}: ProgressIndicatorProps) {
  const [isComplete, setIsComplete] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const config = typeConfig[type];
  const IconComponent = config.icon;

  useEffect(() => {
    if (progress >= 100 && !error) {
      setIsComplete(true);
      setTimeout(() => {
        setShowResult(true);
        onComplete?.(result);
      }, 500);
    }
  }, [progress, error, result, onComplete]);

  useEffect(() => {
    if (error) {
      toast.error(`${config.title} failed`, {
        description: error
      });
    }
  }, [error, config.title]);

  if (!show) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {error ? (
              <AlertCircle className="h-6 w-6 text-red-500" />
            ) : isComplete ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <IconComponent className={`h-6 w-6 text-${config.color}-500`} />
            )}
            <h3 className="text-lg font-semibold">
              {error ? 'Error' : isComplete ? 'Complete' : config.title}
            </h3>
          </div>
          
          {onCancel && !isComplete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Status */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">{status}</p>
          
          {!error && !isComplete && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{Math.round(progress)}%</span>
                <span>
                  {progress < 30 ? 'Starting...' :
                   progress < 70 ? 'Processing...' :
                   progress < 95 ? 'Finalizing...' : 'Almost done...'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {isComplete && !error && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-sm text-green-700">
                {type === 'upload' && 'Document uploaded successfully'}
                {type === 'export' && 'Document exported successfully'}
                {type === 'batch' && 'All documents processed successfully'}
                {type === 'save' && 'Document saved successfully'}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          {error && (
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          )}
          
          {isComplete && onDownload && (
            <Button
              onClick={onDownload}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          )}
          
          {(isComplete || error) && (
            <Button
              variant={error ? "default" : "outline"}
              onClick={() => {
                setShowResult(false);
                setIsComplete(false);
                onComplete?.();
              }}
            >
              {error ? 'Close' : 'Continue'}
            </Button>
          )}
        </div>

        {/* Loading animation */}
        {!error && !isComplete && (
          <div className="flex items-center justify-center mt-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}
      </div>
    </div>
  );
}

// Batch Progress Indicator for multiple files
interface BatchProgressIndicatorProps {
  show: boolean;
  files: Array<{
    name: string;
    progress: number;
    status: 'pending' | 'processing' | 'completed' | 'error';
    error?: string;
  }>;
  overallProgress: number;
  onCancel?: () => void;
  onComplete?: (results: any[]) => void;
  className?: string;
}

export function BatchProgressIndicator({
  show,
  files,
  overallProgress,
  onCancel,
  onComplete,
  className = ''
}: BatchProgressIndicatorProps) {
  const completedFiles = files.filter(f => f.status === 'completed').length;
  const errorFiles = files.filter(f => f.status === 'error').length;
  const totalFiles = files.length;

  useEffect(() => {
    if (overallProgress >= 100) {
      setTimeout(() => {
        onComplete?.(files);
      }, 1000);
    }
  }, [overallProgress, files, onComplete]);

  if (!show) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-orange-500" />
            <h3 className="text-lg font-semibold">Processing Multiple Files</h3>
          </div>
          
          {onCancel && overallProgress < 100 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Overall Progress</span>
            <span>{completedFiles}/{totalFiles} files completed</span>
          </div>
          <Progress value={overallProgress} className="w-full" />
          {errorFiles > 0 && (
            <p className="text-sm text-red-600 mt-1">
              {errorFiles} file{errorFiles > 1 ? 's' : ''} failed
            </p>
          )}
        </div>

        {/* File List */}
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {files.map((file, index) => (
            <div key={index} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium truncate flex-1 mr-2">
                  {file.name}
                </span>
                <div className="flex items-center gap-2">
                  {file.status === 'completed' && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  {file.status === 'processing' && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  )}
                  <span className="text-xs text-gray-500 capitalize">
                    {file.status}
                  </span>
                </div>
              </div>
              
              {file.status === 'processing' && (
                <Progress value={file.progress} className="w-full h-2" />
              )}
              
              {file.error && (
                <p className="text-xs text-red-600 mt-1">{file.error}</p>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        {overallProgress >= 100 && (
          <div className="flex justify-end mt-4">
            <Button
              onClick={() => onComplete?.(files)}
            >
              Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
