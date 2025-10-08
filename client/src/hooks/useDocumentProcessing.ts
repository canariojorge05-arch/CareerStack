import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  status: string;
  type: 'upload' | 'conversion' | 'export' | 'batch' | 'save';
  error: string | null;
  result: any;
}

interface ConversionOptions {
  preserveStyles?: boolean;
  template?: string;
  filename?: string;
}

interface BatchFile {
  file: File;
  filename: string;
}

export function useDocumentProcessing() {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    status: '',
    type: 'upload',
    error: null,
    result: null
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const resetState = useCallback(() => {
    setProcessingState({
      isProcessing: false,
      progress: 0,
      status: '',
      type: 'upload',
      error: null,
      result: null
    });
  }, []);

  const updateProgress = useCallback((
    progress: number, 
    status: string, 
    type: ProcessingState['type'] = 'upload'
  ) => {
    setProcessingState(prev => ({
      ...prev,
      progress,
      status,
      type,
      isProcessing: progress < 100
    }));
  }, []);

  const setError = useCallback((error: string) => {
    setProcessingState(prev => ({
      ...prev,
      error,
      isProcessing: false
    }));
  }, []);

  const setResult = useCallback((result: any) => {
    setProcessingState(prev => ({
      ...prev,
      result,
      progress: 100,
      isProcessing: false
    }));
  }, []);

  // Upload and convert DOCX to HTML
  const uploadDocx = useCallback(async (
    file: File, 
    options: ConversionOptions = {}
  ): Promise<string | null> => {
    try {
      resetState();
      abortControllerRef.current = new AbortController();

      updateProgress(0, 'Preparing upload...', 'upload');

      const formData = new FormData();
      formData.append('file', file);
      if (options.preserveStyles !== undefined) {
        formData.append('preserveStyles', String(options.preserveStyles));
      }

      updateProgress(10, 'Uploading file...', 'upload');

      const response = await fetch('/api/conversion/docx-to-html', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal
      });

      updateProgress(50, 'Converting document...', 'conversion');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();

      updateProgress(90, 'Finalizing...', 'conversion');

      if (result.success) {
        updateProgress(100, 'Conversion completed', 'conversion');
        setResult(result);
        
        toast.success('Document uploaded and converted successfully', {
          description: `${file.name} is ready for editing`
        });

        return result.html;
      } else {
        throw new Error(result.error || 'Conversion failed');
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        resetState();
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setError(errorMessage);
      toast.error('Upload failed', { description: errorMessage });
      return null;
    }
  }, [resetState, updateProgress, setError, setResult]);

  // Convert HTML to DOCX and download
  const exportDocx = useCallback(async (
    htmlContent: string,
    options: ConversionOptions = {}
  ): Promise<boolean> => {
    try {
      resetState();
      abortControllerRef.current = new AbortController();

      updateProgress(0, 'Preparing export...', 'export');

      const requestBody = {
        html: htmlContent,
        template: options.template || 'default',
        filename: options.filename || 'resume.docx'
      };

      updateProgress(20, 'Converting to DOCX...', 'export');

      const response = await fetch('/api/conversion/html-to-docx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      });

      updateProgress(70, 'Generating file...', 'export');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = options.filename || 'resume.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      updateProgress(100, 'Export completed', 'export');
      setResult({ success: true, filename: options.filename });

      toast.success('Document exported successfully', {
        description: `${options.filename || 'resume.docx'} has been downloaded`
      });

      return true;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        resetState();
        return false;
      }

      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      setError(errorMessage);
      toast.error('Export failed', { description: errorMessage });
      return false;
    }
  }, [resetState, updateProgress, setError, setResult]);

  // Batch convert multiple DOCX files
  const batchConvert = useCallback(async (
    files: BatchFile[],
    options: ConversionOptions = {}
  ): Promise<any[] | null> => {
    try {
      resetState();
      abortControllerRef.current = new AbortController();

      updateProgress(0, 'Starting batch conversion...', 'batch');

      const formData = new FormData();
      files.forEach(({ file }) => {
        formData.append('files', file);
      });

      if (options.preserveStyles !== undefined) {
        formData.append('preserveStyles', String(options.preserveStyles));
      }
      if (options.template) {
        formData.append('template', options.template);
      }

      updateProgress(10, 'Uploading files...', 'batch');

      const response = await fetch('/api/conversion/batch-convert', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Batch conversion failed');
      }

      const result = await response.json();

      if (result.success) {
        const jobId = result.jobId;
        updateProgress(20, 'Processing files...', 'batch');

        // Poll for progress
        const pollProgress = async (): Promise<any> => {
          const statusResponse = await fetch(`/api/conversion/batch-status/${jobId}`, {
            signal: abortControllerRef.current?.signal
          });

          if (!statusResponse.ok) {
            throw new Error('Failed to check batch status');
          }

          const statusData = await statusResponse.json();
          
          if (statusData.success) {
            updateProgress(statusData.progress, statusData.status, 'batch');

            if (statusData.progress >= 100) {
              setResult(statusData.result);
              toast.success('Batch conversion completed', {
                description: `${files.length} files processed`
              });
              return statusData.result;
            } else {
              // Continue polling
              await new Promise(resolve => setTimeout(resolve, 1000));
              return pollProgress();
            }
          } else {
            throw new Error(statusData.error || 'Batch conversion failed');
          }
        };

        return await pollProgress();
      } else {
        throw new Error(result.error || 'Batch conversion failed');
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        resetState();
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Batch conversion failed';
      setError(errorMessage);
      toast.error('Batch conversion failed', { description: errorMessage });
      return null;
    }
  }, [resetState, updateProgress, setError, setResult]);

  // Export multiple resumes as ZIP
  const exportZip = useCallback(async (
    resumes: Array<{ html: string; filename?: string; template?: string }>
  ): Promise<boolean> => {
    try {
      resetState();
      abortControllerRef.current = new AbortController();

      updateProgress(0, 'Preparing ZIP export...', 'export');

      const response = await fetch('/api/conversion/export-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resumes }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'ZIP export failed');
      }

      const result = await response.json();

      if (result.success) {
        const jobId = result.jobId;
        updateProgress(10, 'Creating ZIP archive...', 'export');

        // Poll for progress and download when ready
        const pollAndDownload = async (): Promise<boolean> => {
          const statusResponse = await fetch(`/api/conversion/export-status/${jobId}`, {
            signal: abortControllerRef.current?.signal
          });

          if (!statusResponse.ok) {
            throw new Error('Failed to check export status');
          }

          if (statusResponse.headers.get('content-type')?.includes('application/zip')) {
            // File is ready for download
            const blob = await statusResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'resumes.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            updateProgress(100, 'ZIP export completed', 'export');
            setResult({ success: true, filename: 'resumes.zip' });

            toast.success('ZIP export completed', {
              description: 'resumes.zip has been downloaded'
            });

            return true;
          } else {
            // Still processing
            const statusData = await statusResponse.json();
            
            if (statusData.success) {
              updateProgress(statusData.progress, statusData.status, 'export');

              if (statusData.downloadReady) {
                // Try download again
                return pollAndDownload();
              } else {
                // Continue polling
                await new Promise(resolve => setTimeout(resolve, 1000));
                return pollAndDownload();
              }
            } else {
              throw new Error(statusData.error || 'ZIP export failed');
            }
          }
        };

        return await pollAndDownload();
      } else {
        throw new Error(result.error || 'ZIP export failed');
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        resetState();
        return false;
      }

      const errorMessage = error instanceof Error ? error.message : 'ZIP export failed';
      setError(errorMessage);
      toast.error('ZIP export failed', { description: errorMessage });
      return false;
    }
  }, [resetState, updateProgress, setError, setResult]);

  // Save document content
  const saveDocument = useCallback(async (
    content: string,
    documentId?: string
  ): Promise<boolean> => {
    try {
      updateProgress(0, 'Saving document...', 'save');

      // This would integrate with your existing save logic
      // For now, simulating the save process
      await new Promise(resolve => setTimeout(resolve, 500));

      updateProgress(100, 'Document saved', 'save');
      setResult({ success: true, documentId });

      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Save failed';
      setError(errorMessage);
      toast.error('Save failed', { description: errorMessage });
      return false;
    }
  }, [updateProgress, setError, setResult]);

  // Cancel current operation
  const cancelOperation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    resetState();
    toast.info('Operation cancelled');
  }, [resetState]);

  return {
    processingState,
    uploadDocx,
    exportDocx,
    batchConvert,
    exportZip,
    saveDocument,
    cancelOperation,
    resetState
  };
}
