import React, { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { 
  Download, 
  Save, 
  AlertCircle, 
  Loader2, 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  Undo2, 
  Redo2,
  FileText,
  Check,
  Search,
  ChevronUp,
  ChevronDown,
  Printer,
  MessageSquare,
  GitBranch,
  RefreshCw,
  History
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { validateDOCXFileComprehensive, formatFileSize } from '@/utils/fileValidation';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
// fallback to main-thread PDF if worker bundling fails

import '@harbour-enterprises/superdoc/style.css';

interface SuperDocEditorProps {
  fileUrl: string;
  fileName?: string;
  resumeId: string; // Required for saving to server
  onSave?: (content: any) => void;
  onExport?: (file: Blob) => void;
  className?: string;
  height?: string;
}

export function SuperDocEditor({
  fileUrl,
  fileName,
  resumeId,
  onSave,
  onExport,
  className = '',
  height = '100vh'
}: SuperDocEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [superdoc, setSuperdoc] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // New features state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [pageCount, setPageCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [showTrackChanges, setShowTrackChanges] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !isSaving) {
          handleSave();
        }
      }
      // F11 for fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
      // Ctrl+Plus/Minus for zoom
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        handleZoomIn();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        handleZoomOut();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, isSaving, zoom]);

  // Auto-save functionality
  useEffect(() => {
    if (hasChanges && !isSaving) {
      const autoSaveTimer = setTimeout(() => {
        handleSave();
      }, 5000); // Auto-save after 5 seconds

      return () => clearTimeout(autoSaveTimer);
    }
  }, [hasChanges, isSaving]);

  // Fullscreen mode
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Error entering fullscreen:', err);
        toast.error('Could not enter fullscreen mode');
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.error('Error exiting fullscreen:', err);
      });
    }
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 10, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 10, 50));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(100);
  }, []);

  // Apply zoom to editor
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.style.transform = `scale(${zoom / 100})`;
      editorRef.current.style.transformOrigin = 'top center';
    }
  }, [zoom]);

  const computeDiffSummary = (oldText: string, newText: string): string => {
    try {
      const clean = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const a = clean(oldText);
      const b = clean(newText);
      const aWords = a.split(' ');
      const bWords = b.split(' ');
      let diffs: string[] = [];
      const max = Math.max(aWords.length, bWords.length);
      for (let i = 0; i < max; i++) {
        if (aWords[i] !== bWords[i]) {
          if (aWords[i] && !bWords[i]) diffs.push(`- ${aWords[i]}`);
          else if (!aWords[i] && bWords[i]) diffs.push(`+ ${bWords[i]}`);
          else if (aWords[i] && bWords[i]) diffs.push(`- ${aWords[i]}\n+ ${bWords[i]}`);
        }
        if (diffs.length > 50) break;
      }
      if (diffs.length === 0) return 'No changes';
      return diffs.join('\n');
    } catch {
      return 'Diff unavailable';
    }
  };

  useEffect(() => {
    const initializeEditor = async () => {
      if (!editorRef.current) {
        setError('Editor container not available');
        setIsLoading(false);
        return;
      }

      if (!fileUrl) {
        setError('Document URL not provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        setLoadingProgress(10);

        const { SuperDoc } = await import('@harbour-enterprises/superdoc');
        setLoadingProgress(30);

        const editorId = `superdoc-${Date.now()}`;
        const toolbarId = `superdoc-toolbar-${Date.now()}`;
        
        if (editorRef.current) {
          editorRef.current.id = editorId;
        }
        if (toolbarRef.current) {
          toolbarRef.current.id = toolbarId;
        }

        setLoadingProgress(40);

        // Fetch the document with progress tracking
        const response = await fetch(fileUrl, { 
          credentials: 'include',
          headers: {
            'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/octet-stream,*/*'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
        }

        setLoadingProgress(60);
        const blob = await response.blob();
        
        // Ensure we have a proper file type
        const fileType = blob.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const properBlob = new Blob([blob], { type: fileType });

        // Create a File object
        const file = new File([properBlob], fileName || 'document.docx', { 
          type: fileType,
          lastModified: Date.now()
        });

        // Validate file
        const validation = await validateDOCXFileComprehensive(file);
        if (!validation.valid) {
          throw new Error(validation.error || 'Invalid DOCX file');
        }

        setLoadingProgress(75);

        // Add a timeout for initialization
        const initTimeout = setTimeout(() => {
          setError('Document initialization timed out');
          setIsLoading(false);
          toast.error('Document initialization timed out. Please try again.', {
            duration: 5000,
          });
        }, 30000); // 30 second timeout

        // Initialize SuperDoc with full editing mode
        const superdocInstance = new SuperDoc({
          selector: `#${editorId}`,
          toolbar: `#${toolbarId}`,
          documents: [
            {
              id: 'main-document',
              type: 'docx',
              data: file,
            },
          ],
          documentMode: 'editing',
          pagination: true,
          rulers: true,
          onReady: (event: any) => {
            clearTimeout(initTimeout);
            console.log('SuperDoc ready with full editing mode:', event);
            setLoadingProgress(100);
            setIsLoading(false);
            
            // Extract document info
            try {
              // Estimate page count and word count (simplified)
              const content = event?.content || '';
              const estimatedPages = Math.ceil(content.length / 3000) || 1;
              const estimatedWords = content.split(/\s+/).filter(Boolean).length || 0;
              
              setPageCount(estimatedPages);
              setWordCount(estimatedWords);
            } catch (e) {
              console.warn('Could not extract document info:', e);
            }

            toast.success(`${fileName || 'Document'} loaded successfully`, {
              description: 'Full editing mode enabled with all Word features',
              duration: 3000,
            });
          },
          onEditorCreate: (event: any) => {
            console.log('SuperDoc editor created:', event);
          },
        });

        // Listen for content changes
        superdocInstance.on('update', () => {
          setHasChanges(true);
        });

        superdocInstance.on('error', (err: any) => {
          clearTimeout(initTimeout);
          console.error('SuperDoc error:', err);
          setError(err?.message || 'Failed to load document');
          setIsLoading(false);
          toast.error('Failed to load document', {
            description: err?.message || 'An unexpected error occurred',
            duration: 5000,
          });
        });

        setSuperdoc(superdocInstance);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize editor';
        console.error('SuperDoc initialization error:', err);
        setError(errorMessage);
        setIsLoading(false);
        toast.error('Failed to initialize editor', {
          description: errorMessage,
          duration: 5000,
        });
      }
    };

    initializeEditor();

    return () => {
      if (superdoc && typeof superdoc.destroy === 'function') {
        try {
          superdoc.destroy();
        } catch (err) {
          console.warn('Error destroying SuperDoc:', err);
        }
      }

      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      if (toolbarRef.current) {
        toolbarRef.current.innerHTML = '';
      }
    };
  }, [fileUrl, fileName, retryCount]); // Include retryCount to trigger retry

  const handleSave = async () => {
    if (!superdoc || !hasChanges) return;

    setIsSaving(true);
    const toastId = toast.loading('Saving document...', {
      description: 'Preparing to save your changes',
    });

    try {
      // Export current document as DOCX blob
      const exportedBlob = await superdoc.export();
      
      if (!exportedBlob) {
        throw new Error('Failed to export document');
      }

      toast.loading('Uploading to server...', {
        id: toastId,
        description: `Saving ${formatFileSize(exportedBlob.size)}`,
      });

      // Create FormData with the DOCX file
      const formData = new FormData();
      formData.append('file', exportedBlob, fileName || 'document.docx');
      
      // Get CSRF token
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

      // Upload to server
      const response = await fetch(`/api/resumes/${resumeId}/update-file`, {
        method: 'PUT',
        body: formData,
        credentials: 'include',
        headers: {
          'X-CSRF-Token': csrfToken || '',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Save failed');
      }

      const result = await response.json();

      // Update UI state
      setHasChanges(false);
      setLastSaved(new Date());
      onSave?.(exportedBlob);
      
      toast.success(`${fileName || 'Document'} saved to server`, {
        id: toastId,
        description: `Saved at ${new Date().toLocaleTimeString()} • ${formatFileSize(exportedBlob.size)}`,
        duration: 3000,
      });
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save document', {
        id: toastId,
        description: err instanceof Error ? err.message : 'Unknown error',
        action: {
          label: 'Retry',
          onClick: () => handleSave(),
        },
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (!superdoc) return;

    try {
      toast.loading('Preparing document for export...', { id: 'export' });
      
      const exportedBlob = await superdoc.export();

      if (exportedBlob) {
        const url = URL.createObjectURL(exportedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'document.docx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        onExport?.(exportedBlob);
        
        toast.success('Document exported successfully', {
          id: 'export',
          description: `Downloaded as ${fileName || 'document.docx'}`,
          duration: 3000,
        });
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export document', {
        id: 'export',
        description: 'An error occurred during export',
        duration: 5000,
      });
    }
  };

  // Undo/Redo handlers
  const handleUndo = () => {
    if (superdoc && typeof superdoc.undo === 'function') {
      superdoc.undo();
    } else {
      document.execCommand('undo');
    }
  };

  const handleRedo = () => {
    if (superdoc && typeof superdoc.redo === 'function') {
      superdoc.redo();
    } else {
      document.execCommand('redo');
    }
  };

  // Print handler
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Search handlers
  const handleSearch = () => {
    if (!searchTerm) return;
    // SuperDoc search API (if available)
    if (superdoc && typeof superdoc.search === 'function') {
      superdoc.search(searchTerm);
    } else {
      // Fallback to browser find (Ctrl+F)
      // Note: window.find is non-standard, use native browser search
      if (typeof (window as any).find === 'function') {
        (window as any).find(searchTerm);
      } else {
        toast.info('Use Ctrl+F to search in the document');
      }
    }
  };

  const handleReplace = () => {
    if (!searchTerm || !replaceTerm) return;
    if (superdoc && typeof superdoc.replace === 'function') {
      superdoc.replace(searchTerm, replaceTerm);
    }
    toast.success('Text replaced');
  };

  const handleReplaceAll = () => {
    if (!searchTerm || !replaceTerm) return;
    if (superdoc && typeof superdoc.replaceAll === 'function') {
      superdoc.replaceAll(searchTerm, replaceTerm);
      toast.success('All instances replaced');
    }
  };

  // Page navigation
  const jumpToPage = (page: number) => {
    if (page < 1 || page > pageCount) return;
    
    const pageElement = document.querySelector(`.superdoc-editor [data-page="${page}"], .superdoc-editor .page:nth-child(${page})`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(page);
    }
  };

  const handlePrevPage = () => {
    jumpToPage(Math.max(1, currentPage - 1));
  };

  const handleNextPage = () => {
    jumpToPage(Math.min(pageCount, currentPage + 1));
  };

  // Track changes toggle
  const toggleTrackChanges = () => {
    if (superdoc && typeof superdoc.enableTrackChanges === 'function') {
      const isTracking = superdoc.isTrackingChanges || false;
      if (isTracking) {
        superdoc.disableTrackChanges?.();
      } else {
        superdoc.enableTrackChanges?.();
      }
      setShowTrackChanges(!isTracking);
    } else {
      setShowTrackChanges(!showTrackChanges);
      toast.info(showTrackChanges ? 'Track changes disabled' : 'Track changes enabled');
    }
  };

  // Retry loading
  const handleRetry = () => {
    setError(null);
    setRetryCount(prev => prev + 1);
    setIsLoading(true);
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`} style={{ height }}>
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Document</h3>
          <p className="text-gray-600 mb-2">{error}</p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-500 mb-6">
              Retry attempt: {retryCount}
            </p>
          )}
          <div className="flex gap-2 justify-center">
            <Button 
              onClick={handleRetry}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Retrying...' : 'Try Again'}
            </Button>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
            >
              Reload Page
            </Button>
          </div>
          {retryCount > 2 && (
            <p className="text-sm text-gray-500 mt-4">
              Having trouble? The document might be corrupted or the server may be experiencing issues.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div 
        ref={containerRef}
        className={`relative flex flex-col ${className} ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`} 
        style={!isFullscreen ? { height } : undefined}
      >
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm z-50">
            <div className="bg-white p-8 rounded-xl shadow-2xl max-w-sm w-full">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                Loading Document
              </h3>
              <p className="text-sm text-gray-600 mb-4 text-center">
                {loadingProgress < 30 && 'Initializing editor...'}
                {loadingProgress >= 30 && loadingProgress < 60 && 'Downloading document...'}
                {loadingProgress >= 60 && loadingProgress < 90 && 'Validating file...'}
                {loadingProgress >= 90 && 'Almost ready...'}
              </p>
              <Progress value={loadingProgress} className="mb-2" />
              <p className="text-xs text-center text-gray-500">{loadingProgress}%</p>
            </div>
          </div>
        )}
        
        {/* Enhanced Action Bar with Visual Hierarchy */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b-2 border-blue-500 bg-gradient-to-r from-white via-blue-50 to-white shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block w-1 h-10 bg-blue-500 rounded-full"></div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h2 className="text-base sm:text-lg font-bold text-gray-900">
                  {fileName || 'Document Editor'}
                </h2>
              </div>
              {/* Document Info */}
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span>DOCX Document</span>
                {pageCount > 0 && (
                  <>
                    <span>•</span>
                    <span>{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
                  </>
                )}
                {wordCount > 0 && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline">{wordCount.toLocaleString()} words</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Status Badges */}
            {isLoading && (
              <Badge variant="outline" className="animate-pulse ml-2">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Loading...
              </Badge>
            )}
            {hasChanges && !isLoading && (
              <Badge variant="outline" className="text-orange-600 border-orange-300 ml-2">
                Unsaved changes
              </Badge>
            )}
            {!hasChanges && lastSaved && !isLoading && (
              <Badge variant="outline" className="text-green-600 border-green-300 ml-2">
                <Check className="h-3 w-3 mr-1" />
                Saved
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Undo/Redo */}
            <div className="hidden md:flex items-center gap-1 mr-2 pr-2 border-r">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleUndo}
                    disabled={isLoading}
                    className="h-8 w-8 p-0"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Undo (Ctrl+Z)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleRedo}
                    disabled={isLoading}
                    className="h-8 w-8 p-0"
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Redo (Ctrl+Y)</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Zoom Controls */}
            <div className="hidden lg:flex items-center gap-1 mr-2 pr-2 border-r">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={zoom <= 50}
                    className="h-8 w-8 p-0"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Zoom Out (Ctrl+-)</p>
                </TooltipContent>
              </Tooltip>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleZoomReset}
                className="text-xs min-w-[3rem] h-8"
              >
                {zoom}%
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={zoom >= 200}
                    className="h-8 w-8 p-0"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Zoom In (Ctrl++)</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Save Button with State */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSave}
                  disabled={isLoading || !superdoc || !hasChanges || isSaving}
                  variant={hasChanges ? "default" : "outline"}
                  size="sm"
                  className={`${hasChanges ? 'bg-green-600 hover:bg-green-700 text-white' : ''} hidden sm:flex`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">
                    {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save document (Ctrl+S)</p>
                {lastSaved && <p className="text-xs text-gray-400">Last saved: {lastSaved.toLocaleTimeString()}</p>}
              </TooltipContent>
            </Tooltip>

            {/* Mobile Save Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSave}
                  disabled={isLoading || !superdoc || !hasChanges || isSaving}
                  variant={hasChanges ? "default" : "outline"}
                  size="sm"
                  className={`sm:hidden ${hasChanges ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save (Ctrl+S)</TooltipContent>
            </Tooltip>

            {/* Export Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleExport}
                  disabled={isLoading || !superdoc}
                  size="sm"
                  className="hidden sm:flex"
                >
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download as DOCX</p>
              </TooltipContent>
            </Tooltip>

            {/* Mobile Export */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleExport}
                  disabled={isLoading || !superdoc}
                  size="sm"
                  className="sm:hidden"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export</TooltipContent>
            </Tooltip>

            {/* Search Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowSearch(!showSearch)}
                  disabled={isLoading || !superdoc}
                  variant={showSearch ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0 hidden md:flex"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Search (Ctrl+F)</p>
              </TooltipContent>
            </Tooltip>

            {/* Print Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handlePrint}
                  disabled={isLoading || !superdoc}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hidden lg:flex"
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Print (Ctrl+P)</p>
              </TooltipContent>
            </Tooltip>

            {/* Track Changes Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={toggleTrackChanges}
                  disabled={isLoading || !superdoc}
                  variant={showTrackChanges ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0 hidden xl:flex"
                >
                  <GitBranch className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{showTrackChanges ? 'Tracking Changes' : 'Track Changes'}</p>
              </TooltipContent>
            </Tooltip>

            {/* Comments Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowComments(!showComments)}
                  disabled={isLoading || !superdoc}
                  variant={showComments ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0 hidden xl:flex"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Comments</p>
              </TooltipContent>
            </Tooltip>

            {/* Fullscreen Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={toggleFullscreen}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'} (F11)</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Search Panel */}
        {showSearch && (
          <div className="border-b bg-white p-3 shrink-0">
            <div className="flex gap-2 items-center max-w-4xl mx-auto">
              <Input
                placeholder="Find..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Input
                placeholder="Replace with..."
                value={replaceTerm}
                onChange={(e) => setReplaceTerm(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSearch} size="sm" disabled={!searchTerm}>
                Find
              </Button>
              <Button onClick={handleReplace} size="sm" variant="outline" disabled={!searchTerm || !replaceTerm}>
                Replace
              </Button>
              <Button onClick={handleReplaceAll} size="sm" variant="outline" disabled={!searchTerm || !replaceTerm}>
                Replace All
              </Button>
              <Button onClick={() => setShowSearch(false)} size="sm" variant="ghost">
                ✕
              </Button>
            </div>
          </div>
        )}

        {/* Page Navigation Bar */}
        {pageCount > 1 && !isLoading && (
          <div className="border-b bg-gray-50 px-4 py-2 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 hidden sm:inline">Page:</span>
              <Button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                min="1"
                max={pageCount}
                value={currentPage}
                onChange={(e) => jumpToPage(parseInt(e.target.value) || 1)}
                className="w-16 h-7 text-center text-sm"
              />
              <span className="text-sm text-gray-600">of {pageCount}</span>
              <Button
                onClick={handleNextPage}
                disabled={currentPage >= pageCount}
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* SuperDoc Toolbar - Flexible Height */}
        <div 
          ref={toolbarRef}
          className="superdoc-toolbar shrink-0 border-b bg-white overflow-x-auto overflow-y-hidden"
          style={{ minHeight: '48px', maxHeight: '120px' }}
        />

        {/* Main Content Area with Editor and Sidebars */}
        <div className="flex-1 flex overflow-hidden">
          {/* SuperDoc Editor Container */}
          <div 
            ref={editorRef} 
            className="superdoc-editor flex-1 overflow-y-auto overflow-x-auto bg-gray-100 transition-transform duration-200"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
          />

          {/* Track Changes Panel */}
          {showTrackChanges && (
            <div className="w-80 border-l bg-white p-4 overflow-y-auto shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Track Changes
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowTrackChanges(false)}
                  className="h-6 w-6 p-0"
                >
                  ✕
                </Button>
              </div>
              
              <div className="text-sm text-gray-500 text-center py-8">
                <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Track changes panel</p>
                <p className="text-xs mt-1">Changes will appear here</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={toggleTrackChanges}
                >
                  {showTrackChanges ? 'Stop' : 'Start'} Tracking
                </Button>
              </div>
            </div>
          )}

          {/* Comments Panel */}
          {showComments && (
            <div className="w-80 border-l bg-white p-4 overflow-y-auto shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comments
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowComments(false)}
                  className="h-6 w-6 p-0"
                >
                  ✕
                </Button>
              </div>
              
              <div className="text-sm text-gray-500 text-center py-8">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No comments yet</p>
                <p className="text-xs mt-1">Comments will appear here</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                >
                  Add Comment
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Last Saved Timestamp (Mobile) */}
        {lastSaved && !isLoading && (
          <div className="sm:hidden px-4 py-2 bg-gray-50 border-t text-xs text-gray-500 text-center">
            Last saved: {lastSaved.toLocaleTimeString()}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default SuperDocEditor;
