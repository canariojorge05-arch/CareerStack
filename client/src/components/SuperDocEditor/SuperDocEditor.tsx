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
import { Download, Save, AlertCircle, Loader2, ZoomIn, ZoomOut, Maximize2, Minimize2, List, Image as ImageIcon, Columns2, Type, ChevronDown, ChevronUp, Search, Settings, FilePlus2, Table as TableIcon, MessageSquare, PenLine, BookMarked, History } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
// fallback to main-thread PDF if worker bundling fails

import '@harbour-enterprises/superdoc/style.css';

interface SuperDocEditorProps {
  fileUrl: string;
  fileName?: string;
  resumeId: string; // Required for saving to server
  resumeId?: string;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<any>(null);
  const [zoom, setZoom] = useState<number>(() => {
    const stored = localStorage.getItem('docx_zoom');
    return stored ? Number(stored) : 1;
  });
  const [fitMode, setFitMode] = useState<'none' | 'fitWidth' | 'fitPage'>(() => (localStorage.getItem('docx_fit') as any) || 'none');
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [showOutline, setShowOutline] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [distractionFree, setDistractionFree] = useState<boolean>(false);
  const [pageCount, setPageCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState<boolean>(false);
  const [outline, setOutline] = useState<Array<{ level: number; text: string; top: number }>>([]);
  const [wordCount, setWordCount] = useState<number>(0);
  const [charCount, setCharCount] = useState<number>(0);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showExport, setShowExport] = useState<boolean>(false);
  const [showFind, setShowFind] = useState<boolean>(false);
  const [showReplace, setShowReplace] = useState<boolean>(false);
  const [findQuery, setFindQuery] = useState<string>('');
  const [findIndex, setFindIndex] = useState<number>(0);
  const [showTable, setShowTable] = useState<boolean>(false);
  const [showComments, setShowComments] = useState<boolean>(false);
  const [showTrack, setShowTrack] = useState<boolean>(false);
  const [commentDraft, setCommentDraft] = useState<string>('');
  const [footnoteCount, setFootnoteCount] = useState<number>(0);
  const [exportIncludeComments, setExportIncludeComments] = useState<boolean>(true);
  const [exportAcceptTracked, setExportAcceptTracked] = useState<boolean>(false);
  const [exportFlatten, setExportFlatten] = useState<boolean>(false);
  const [showVersions, setShowVersions] = useState<boolean>(false);
  const [versions, setVersions] = useState<Array<{ ts: string; label: string; fileName: string; contentLen: number; content?: string }>>([]);

  const pageSelector = '.pagination-inner';
  const proseSelector = '.ProseMirror';

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
        // Set up event listeners if available
        if (editorInstance && typeof editorInstance.on === 'function') {
          editorInstance.on('ready', () => {
            setIsLoading(false);
            toast.success('Document loaded successfully');
            setTimeout(() => {
              recomputeLayout();
              generateOutline();
              generateThumbnailsLazy();
            }, 100);
            // Load server thumbnails if present
            if (resumeId) {
              fetch(`/api/resumes/${resumeId}/thumbnails`, { credentials: 'include' })
                .then(r => r.ok ? r.json() : null)
                .then((data) => {
          if (Array.isArray(data?.images) && data.images.length) setThumbnails(data.images);
                }).catch(() => {});
            }
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
      window.removeEventListener('keydown', onKeyDownNav);
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
  // Persist zoom/fit and bind events
  useEffect(() => { localStorage.setItem('docx_zoom', String(zoom)); }, [zoom]);
  useEffect(() => { localStorage.setItem('docx_fit', fitMode); }, [fitMode]);
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
  useEffect(() => {
    const onScroll = () => updateCurrentPage();
    const sc = scrollRef.current;
    sc?.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onScroll);
    return () => {
      sc?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const getPageEls = (): HTMLElement[] => {
    const root = editorRef.current;
    if (!root) return [];
    const pages = Array.from(root.querySelectorAll(pageSelector)) as HTMLElement[];
    return pages.length ? pages : (root.querySelector(proseSelector) ? [root.querySelector(proseSelector)! as HTMLElement] : []);
  };
  const recomputeLayout = () => {
    const pages = getPageEls();
    setPageCount(pages.length || 1);
    updateWordCharCounts();
    updateCurrentPage();
    if (fitMode !== 'none') fitToMode(fitMode as 'fitWidth' | 'fitPage');
    updatePageVisibility();
  };
  const updateCurrentPage = () => {
    const sc = scrollRef.current;
    const pages = getPageEls();
    if (!sc || !pages.length) return;
    const viewMid = sc.scrollTop + sc.clientHeight / 2;
    let idx = 0;
    for (let i = 0; i < pages.length; i++) {
      const el = pages[i];
      const top = el.getBoundingClientRect().top + sc.scrollTop - (pages[0].getBoundingClientRect().top + sc.scrollTop);
      const height = el.getBoundingClientRect().height;
      if (viewMid >= top && viewMid <= top + height) { idx = i; break; }
    }
    setCurrentPage(idx + 1);
    updatePageVisibility(idx);
  };

  // Simple virtualization: keep nearby pages visible
  const updatePageVisibility = (centerIndex?: number) => {
    const pages = getPageEls();
    if (!pages.length) return;
    const idx = centerIndex ?? Math.max(0, Math.min(currentPage - 1, pages.length - 1));
    const radius = 2; // show +/- 2
    for (let i = 0; i < pages.length; i++) {
      const el = pages[i];
      const dist = Math.abs(i - idx);
      (el.style as any).visibility = dist <= radius ? 'visible' : 'hidden';
    }
  };
  const updateWordCharCounts = () => {
    const root = editorRef.current;
    if (!root) return;
    const prose = root.querySelector(proseSelector);
    const text = (prose?.textContent || '').trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    setWordCount(words);
    setCharCount(text.length);
  };
  const generateOutline = () => {
    const root = editorRef.current;
    const sc = scrollRef.current;
    if (!root || !sc) return;
    const prose = root.querySelector(proseSelector) as HTMLElement | null;
    if (!prose) { setOutline([]); return; }
    const headingEls = Array.from(prose.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
    const baseTop = prose.getBoundingClientRect().top + sc.scrollTop;
    const items = headingEls.map(h => ({
      level: Number(h.tagName.substring(1)),
      text: h.textContent || '(untitled)',
      top: h.getBoundingClientRect().top + sc.scrollTop - baseTop
    }));
    setOutline(items);
  };
  const generateThumbnailsLazy = async () => {
    if (isGeneratingThumbs) return;
    setIsGeneratingThumbs(true);
    const pages = getPageEls();
    const limit = Math.min(pages.length, 30);
    const imgs: string[] = [];
    let i = 0;
    const step = async () => {
      if (i >= limit) {
        setThumbnails(imgs);
        setIsGeneratingThumbs(false);
        // upload to server for caching if resumeId is available
        if (resumeId && imgs.length > 0) {
          try {
            await fetch(`/api/resumes/${resumeId}/thumbnails`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ images: imgs })
            });
          } catch {}
        }
        return;
      }
      try {
        const el = pages[i];
        const canvas = await html2canvas(el, { scale: 0.2, useCORS: true, backgroundColor: '#ffffff' });
        imgs[i] = canvas.toDataURL('image/png');
        setThumbnails(imgs.slice());
      } catch {}
      i++;
      (window as any).requestIdleCallback ? (window as any).requestIdleCallback(step) : setTimeout(step, 50);
    };
    step();
  };
  const fitToMode = (mode: 'fitWidth' | 'fitPage') => {
    const sc = scrollRef.current;
    const pages = getPageEls();
    if (!sc || !pages.length) return;
    const page = pages[0];
    const pageRect = page.getBoundingClientRect();
    const availW = sc.clientWidth - 24;
    const availH = sc.clientHeight - 24;
    if (mode === 'fitWidth') {
      const k = availW / pageRect.width;
      setZoom(Math.max(0.5, Math.min(k, 3)));
    } else {
      const k = Math.min(availW / pageRect.width, availH / pageRect.height);
      setZoom(Math.max(0.5, Math.min(k, 3)));
    }
  };
  const onKeyDownNav = (e: KeyboardEvent) => {
    const pages = getPageEls();
    const sc = scrollRef.current;
    if (!pages.length || !sc) return;
    if (e.key === 'PageDown' || (e.ctrlKey && e.key === 'ArrowDown')) {
      e.preventDefault();
      const idx = Math.min(currentPage, pages.length - 1);
      pages[idx].scrollIntoView({ behavior: 'smooth' });
    } else if (e.key === 'PageUp' || (e.ctrlKey && e.key === 'ArrowUp')) {
      e.preventDefault();
      const idx = Math.max(0, currentPage - 2);
      pages[idx].scrollIntoView({ behavior: 'smooth' });
    }
  };
  useEffect(() => {
    const onKeyShortcuts = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); setShowFind(true); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') { e.preventDefault(); setShowReplace(true); }
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) { e.preventDefault(); zoomIn(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' )) { e.preventDefault(); zoomOut(); }
    };
    window.addEventListener('keydown', onKeyNavWrapper);
    window.addEventListener('keydown', onKeyShortcuts);
    return () => window.removeEventListener('keydown', onKeyDownNav);
  }, [currentPage]);

  // wrapper maintains references
  const onKeyNavWrapper = (e: KeyboardEvent) => onKeyDownNav(e);

  const zoomIn = () => setZoom(z => Math.min(3, Number((z + 0.1).toFixed(2))));
  const zoomOut = () => setZoom(z => Math.max(0.5, Number((z - 0.1).toFixed(2))));
  const setFit = (mode: 'none' | 'fitWidth' | 'fitPage') => {
    setFitMode(mode);
    if (mode === 'none') return;
    fitToMode(mode);
  };
  const requestFullscreen = () => {
    const el = (scrollRef.current?.parentElement || document.documentElement) as any;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };
  const toggleDistractionFree = () => setDistractionFree(v => !v);
  const gotoPage = () => {
    const n = Number(prompt(`Go to page (1-${pageCount})`, String(currentPage)));
    if (!Number.isFinite(n)) return;
    const pages = getPageEls();
    const idx = Math.max(1, Math.min(pageCount, Math.round(n))) - 1;
    pages[idx]?.scrollIntoView({ behavior: 'smooth' });
  };

  // Settings: page setup and header/footer controls
  const applyPageSize = (size: 'A4' | 'Letter') => {
    try {
      const active = (editor?.activeEditor) || editor;
      const styles = active?.getPageStyles?.() || {};
      const isA4 = size === 'A4';
      const width = isA4 ? 595 : 612;
      const height = isA4 ? 842 : 792;
      active?.updatePageStyle?.({ pageSize: { width, height }, pageMargins: styles.pageMargins });
      recomputeLayout();
    } catch {}
  };
  const applyMargins = (top: number, right: number, bottom: number, left: number) => {
    try {
      const active = (editor?.activeEditor) || editor;
      active?.updatePageStyle?.({ pageMargins: { top, right, bottom, left } });
      recomputeLayout();
    } catch {}
  };
  const toggleHeaderFooterEdit = () => {
    const root = editorRef.current;
    if (!root) return;
    const prose = root.querySelector('.ProseMirror');
    if (!prose) return;
    prose.classList.toggle('header-footer-edit');
  };
  const insertPageBreak = () => {
    try { document.execCommand('insertHTML', false, '<div style="page-break-after: always; height:1px;"></div>'); } catch {}
  };
  const insertAutoPageNumber = () => {
    try { document.execCommand('insertHTML', false, '<span class="sd-editor-auto-page-number" data-id="auto-page-number">{page}</span>'); }
    catch { document.execCommand('insertText', false, ' {page} '); }
  };
  const insertAutoTotalPages = () => {
    try { document.execCommand('insertHTML', false, '<span class="sd-editor-auto-total-pages" data-id="auto-total-pages">{total}</span>'); }
    catch { document.execCommand('insertText', false, ' {total} '); }
  };
  const insertDateTime = () => {
    const s = new Date().toLocaleString();
    try { document.execCommand('insertText', false, ` ${s} `); } catch {}
  };

  // Styles shortcuts
  const applyHeading = (level: 1 | 2 | 3 | 0) => {
    try {
      if (level === 0) document.execCommand('formatBlock', false, 'p');
      else document.execCommand('formatBlock', false, 'h' + level);
      generateOutline();
    } catch {}
  };

  // Image alt text
  const setSelectedImageAlt = async () => {
    const sel = document.getSelection();
    if (!sel || !sel.anchorNode) return;
    const el = (sel.anchorNode as HTMLElement).parentElement || null;
    const img = el?.closest('img');
    if (!img) { toast.info('Select near an image first'); return; }
    const v = prompt('Alt text for image:', img.getAttribute('alt') || '');
    if (v !== null) img.setAttribute('alt', v);
  };

  // Export: DOCX options & PDF
  const exportDocxWithOptions = async (opts: { includeComments: boolean; acceptTracked: boolean }) => {
    try {
      const active = (editor?.activeEditor) || editor;
      if (exportFlatten) flattenFields();
      const blob = await active?.exportDocx?.({
        isFinalDoc: opts.acceptTracked,
        commentsType: opts.includeComments ? 'all' : 'none',
      });
      if (blob) {
        const url = URL.createObjectURL(blob as Blob);
        const a = document.createElement('a');
        a.href = url; a.download = (fileName || 'document') + '.docx'; a.click(); URL.revokeObjectURL(url);
      } else {
        toast.error('Export failed');
      }
    } catch (e) { toast.error('Export failed'); }
  };
  const exportPdfWithWatermark = async (watermark?: string) => {
    try {
      const pages = getPageEls(); if (!pages.length) return;
      // Fallback main-thread PDF creation
      const pdf = new jsPDF('p', 'pt', 'a4');
      for (let i = 0; i < pages.length; i++) {
        const c = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const img = c.toDataURL('image/jpeg', 0.95);
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(img, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        if (watermark) { pdf.setFontSize(48); pdf.setTextColor(150, 150, 150); pdf.text(watermark, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 }); }
        if (i < pages.length - 1) pdf.addPage();
      }
      pdf.save((fileName || 'document') + '.pdf');
    } catch (e) { toast.error('PDF export failed'); }
  };

  // Find/Replace (basic)
  const getAllMatches = (): Array<{ el: HTMLElement; start: number }> => {
    const root = editorRef.current; if (!root || !findQuery) return [];
    const prose = root.querySelector(proseSelector) as HTMLElement | null; if (!prose) return [];
    const blocks = Array.from(prose.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6')) as HTMLElement[];
    const q = findQuery.toLowerCase();
    const res: Array<{ el: HTMLElement; start: number }> = [];
    blocks.forEach(b => { const t = (b.textContent || '').toLowerCase(); const idx = t.indexOf(q); if (idx >= 0) res.push({ el: b, start: idx }); });
    return res;
  };
  const gotoMatch = (dir: 1 | -1) => {
    const matches = getAllMatches(); if (!matches.length) return;
    let i = findIndex + dir; if (i < 0) i = matches.length - 1; if (i >= matches.length) i = 0;
    setFindIndex(i);
    matches[i].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const replaceNext = (replacement: string) => {
    const matches = getAllMatches(); if (!matches.length) return;
    const i = findIndex >= 0 && findIndex < matches.length ? findIndex : 0;
    const el = matches[i].el;
    const re = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), '');
    el.innerHTML = (el.innerHTML || '').replace(re, replacement);
    gotoMatch(1);
  };
  const replaceAll = (replacement: string, caseSensitive: boolean, wholeWord: boolean) => {
    if (!findQuery) return;
    const root = editorRef.current; if (!root) return;
    let q = findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) q = `\\b${q}\\b`;
    const flags = caseSensitive ? 'g' : 'gi';
    const re = new RegExp(q, flags);
    const prose = root.querySelector(proseSelector) as HTMLElement | null;
    if (!prose) return;
    prose.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6').forEach((n: any) => {
      n.innerHTML = (n.innerHTML || '').replace(re, replacement);
    });
  };

  // Footnotes
  const insertFootnote = () => {
    const note = prompt('Footnote text:'); if (!note) return;
    const num = footnoteCount + 1; setFootnoteCount(num);
    try {
      document.execCommand('insertHTML', false, `<sup>[${num}]</sup>`);
      const prose = editorRef.current?.querySelector(proseSelector) as HTMLElement | null;
      if (prose) {
        const div = document.createElement('div');
        div.innerHTML = `<p><sup>[${num}]</sup> ${note}</p>`;
        prose.appendChild(div);
      }
    } catch {}
  };
  const insertAnchor = () => {
    const id = prompt('Anchor ID (letters/numbers only):'); if (!id) return;
    const span = document.createElement('span'); span.id = id; span.style.display = 'inline-block'; span.style.width = '0'; span.style.height = '0';
    const sel = document.getSelection(); if (!sel || !sel.rangeCount) return; const r = sel.getRangeAt(0); r.insertNode(span);
  };
  const insertCrossRef = () => {
    const id = prompt('Cross-reference to Anchor ID:'); if (!id) return;
    document.execCommand('insertHTML', false, `<a href="#${id}">${id}</a>`);
  };

  // Flatten fields before DOCX export (optional)
  const flattenFields = () => {
    const root = editorRef.current; if (!root) return;
    root.querySelectorAll('.sd-editor-auto-page-number,.sd-editor-auto-total-pages').forEach((el: any) => { el.outerHTML = el.textContent || ''; });
  };

  const handleSave = () => {
    if (editor) {
      editor.save();
    }
    toast.success('All instances replaced');
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
  // Autosave every 10s if changed
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const active = (editor?.activeEditor) || editor;
        const changed = active?.docChanged;
        if (!changed) return;
        setIsAutoSaving(true);
        await editor?.save?.();
        setLastSavedAt(new Date());
      } catch (e) {
        // ignore transient errors
      } finally {
        setIsAutoSaving(false);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [editor]);


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
    <div className={`relative ${className}`} style={{ height, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading document...</p>
          </div>
        </div>
      )}
      
      {/* Toolbar */}
      <div className={`flex items-center justify-between p-2 md:p-3 border-b bg-gray-50 ${distractionFree ? 'hidden' : ''}` }>
        <div className="flex items-center gap-2">
          <h2 className="text-sm md:text-lg font-semibold text-gray-900">
            {fileName || 'Document Editor'}
          </h2>
          {isLoading && (
            <span className="text-sm text-gray-500">Loading...</span>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 border rounded px-2 py-1 bg-white">
            <Button variant="ghost" size="icon" onClick={() => setFit('fitWidth')} title="Fit width"><Columns2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setFit('fitPage')} title="Fit page"><Type className="h-4 w-4 rotate-90" /></Button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <Button variant="ghost" size="icon" onClick={zoomOut} title="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
            <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" onClick={zoomIn} title="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
          </div>

          {/* Panels toggles */}
          <Button variant="outline" size="sm" onClick={() => setShowThumbnails(v => !v)}>
            <ImageIcon className="h-4 w-4 mr-1" /> Thumbnails
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowOutline(v => !v)}>
            <List className="h-4 w-4 mr-1" /> Outline
          </Button>
          <Button variant="outline" size="sm" onClick={gotoPage}>
            <Search className="h-4 w-4 mr-1" /> Go to page
          </Button>
          <Button variant="outline" size="sm" onClick={requestFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4 mr-1" /> : <Maximize2 className="h-4 w-4 mr-1" />} {isFullscreen ? 'Exit Full' : 'Full screen'}
          </Button>
          <Button variant="outline" size="sm" onClick={toggleDistractionFree}>
            {distractionFree ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronUp className="h-4 w-4 mr-1" />} Focus
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(v => !v)}>
            <Settings className="h-4 w-4 mr-1" /> Page setup
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowExport(v => !v)}>
            <FilePlus2 className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowTable(v => !v)}>
            <TableIcon className="h-4 w-4 mr-1" /> Table
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowComments(v => !v)}>
            <MessageSquare className="h-4 w-4 mr-1" /> Comments
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowTrack(v => !v)}>
            <PenLine className="h-4 w-4 mr-1" /> Track changes
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFind(v => !v)}>
            <Search className="h-4 w-4 mr-1" /> Find
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowReplace(v => !v)}>
            <Search className="h-4 w-4 mr-1 rotate-180" /> Replace
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (!resumeId) return;
            setShowVersions(true);
            fetch(`/api/resumes/${resumeId}/versions`, { credentials: 'include' })
              .then(r => r.ok ? r.json() : [])
              .then(setVersions)
              .catch(() => setVersions([]));
          }}>
            <History className="h-4 w-4 mr-1" /> Versions
          </Button>

          <Button onClick={handleSave} disabled={isLoading || !editor} variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" /> Save
          </Button>
          <Button onClick={handleExport} disabled={isLoading || !editor} size="sm">
            <Download className="h-4 w-4 mr-2" /> Export DOCX
          </Button>
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
      {/* Editor Layout */}
      <div className="flex" style={{ height: 'calc(100% - 56px)' }}>
        {showThumbnails && (
          <div className="w-44 border-r bg-white overflow-auto p-2 hidden md:block">
            <div className="text-xs text-gray-500 mb-2">Pages ({pageCount})</div>
            <div className="space-y-2">
              {thumbnails.length === 0 && <div className="text-xs text-gray-400">{isGeneratingThumbs ? 'Generating thumbnails…' : 'No thumbnails yet'}</div>}
              {thumbnails.map((src, i) => (
                <button key={i} className={`block w-full border ${currentPage === i + 1 ? 'ring-2 ring-blue-500' : 'border-gray-200'} rounded overflow-hidden`} onClick={() => {
                  const pages = getPageEls();
                  pages[i]?.scrollIntoView({ behavior: 'smooth' });
                }}>
                  <img src={src} alt={`Page ${i + 1}`} className="w-full block" />
                  <div className="text-center text-[10px] py-1 text-gray-600">{i + 1}</div>
                </button>
              ))}
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
        <div ref={scrollRef} className="flex-1 overflow-auto bg-gray-100">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <div ref={editorRef} />
          </div>
        </div>

        {showOutline && (
          <div className="w-60 border-l bg-white overflow-auto p-2 hidden lg:block">
            <div className="text-xs text-gray-500 mb-2">Outline</div>
            <div className="space-y-1">
              {outline.length === 0 && <div className="text-xs text-gray-400">No headings found</div>}
              {outline.map((h, i) => (
                <button key={i} className="block w-full text-left text-xs hover:bg-gray-50 rounded px-2 py-1" style={{ paddingLeft: `${(h.level - 1) * 10 + 8}px` }} onClick={() => {
                  const sc = scrollRef.current;
                  const pages = getPageEls();
                  if (sc && pages.length) {
                    const firstTop = pages[0].getBoundingClientRect().top + sc.scrollTop;
                    sc.scrollTo({ top: firstTop + h.top - 20, behavior: 'smooth' });
                  }
                }}>
                  {h.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      {!distractionFree && (
        <div className="h-8 border-t bg-white px-3 flex items-center justify-between text-xs text-gray-600">
          <div>Page {currentPage} of {pageCount}</div>
          <div className="flex items-center gap-3">
            {isAutoSaving ? <span>Autosaving…</span> : lastSavedAt ? <span>Saved {lastSavedAt.toLocaleTimeString()}</span> : null}
            <span>{wordCount.toLocaleString()} words • {charCount.toLocaleString()} chars</span>
          </div>
        </div>
      )}

      {/* Page setup panel */}
      {showSettings && !distractionFree && (
        <div className="absolute right-2 top-16 z-20 w-72 bg-white border rounded shadow p-3 space-y-2">
          <div className="text-xs font-semibold text-gray-700">Page size</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => applyPageSize('A4')}>A4</Button>
            <Button size="sm" variant="outline" onClick={() => applyPageSize('Letter')}>Letter</Button>
          </div>
          <div className="text-xs font-semibold text-gray-700 mt-2">Margins (pt)</div>
          <div className="grid grid-cols-4 gap-2">
            {['Top','Right','Bottom','Left'].map((label, idx) => (
              <input key={label} aria-label={`margin-${label.toLowerCase()}`} className="border rounded px-2 py-1 text-xs" placeholder={label} onBlur={(e) => {
                const vals = ['Top','Right','Bottom','Left'].map(l => Number((document.querySelector(`[aria-label=margin-${l.toLowerCase()}]`) as HTMLInputElement)?.value || '72'));
                applyMargins(vals[0], vals[1], vals[2], vals[3]);
              }} />
            ))}
          </div>
          <div className="text-xs font-semibold text-gray-700 mt-2">Header/Footer</div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={toggleHeaderFooterEdit}>Toggle edit</Button>
            <Button size="sm" variant="outline" onClick={insertAutoPageNumber}>Insert page #</Button>
            <Button size="sm" variant="outline" onClick={insertAutoTotalPages}>Insert total pages</Button>
            <Button size="sm" variant="outline" onClick={insertDateTime}>Insert date/time</Button>
            <Button size="sm" variant="outline" onClick={insertPageBreak}>Insert page break</Button>
          </div>
          <div className="text-xs font-semibold text-gray-700 mt-2">Styles</div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => applyHeading(1)}>H1</Button>
            <Button size="sm" variant="outline" onClick={() => applyHeading(2)}>H2</Button>
            <Button size="sm" variant="outline" onClick={() => applyHeading(3)}>H3</Button>
            <Button size="sm" variant="outline" onClick={() => applyHeading(0)}>Paragraph</Button>
          </div>
          <div className="text-xs font-semibold text-gray-700 mt-2">Images</div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={setSelectedImageAlt}>Set alt text</Button>
          </div>
        </div>
      )}

      {/* Export panel */}
      {showExport && !distractionFree && (
        <div className="absolute right-2 top-16 z-20 w-72 bg-white border rounded shadow p-3 space-y-2">
          <div className="text-xs font-semibold text-gray-700 mb-1">DOCX options</div>
          <div className="space-y-2">
            <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={exportIncludeComments} onChange={e => setExportIncludeComments(e.target.checked)} /> Include comments</label>
            <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={exportAcceptTracked} onChange={e => setExportAcceptTracked(e.target.checked)} /> Accept tracked changes</label>
            <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={exportFlatten} onChange={e => setExportFlatten(e.target.checked)} /> Flatten fields</label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => exportDocxWithOptions({ includeComments: exportIncludeComments, acceptTracked: exportAcceptTracked })}>Export DOCX</Button>
            </div>
          </div>
          <div className="text-xs font-semibold text-gray-700 mt-2">PDF export</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportPdfWithWatermark()}>PDF</Button>
            <Button size="sm" variant="outline" onClick={() => exportPdfWithWatermark('CONFIDENTIAL')}>PDF + Watermark</Button>
          </div>
        </div>
      )}

      {/* Find panel */}
      {showFind && !distractionFree && (
        <div className="absolute left-1/2 -translate-x-1/2 top-16 z-20 w-96 max-w-full bg-white border rounded shadow p-3 flex items-center gap-2">
          <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Find…" value={findQuery} onChange={e => setFindQuery(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => gotoMatch(-1)}>Prev</Button>
          <Button size="sm" variant="outline" onClick={() => gotoMatch(1)}>Next</Button>
        </div>
      )}

      {/* Replace panel */}
      {showReplace && !distractionFree && (
        <div className="absolute left-1/2 -translate-x-1/2 top-32 z-20 w-[28rem] max-w-full bg-white border rounded shadow p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 items-center">
            <input id="rep-with" className="border rounded px-2 py-1 text-sm col-span-2" placeholder="Replace with…" />
            <label className="text-xs flex items-center gap-1"><input id="rep-case" type="checkbox" /> Case sensitive</label>
            <label className="text-xs flex items-center gap-1"><input id="rep-word" type="checkbox" /> Whole word</label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              const r = (document.getElementById('rep-with') as HTMLInputElement)?.value || '';
              replaceNext(r);
            }}>Replace next</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const r = (document.getElementById('rep-with') as HTMLInputElement)?.value || '';
              const cs = (document.getElementById('rep-case') as HTMLInputElement)?.checked || false;
              const ww = (document.getElementById('rep-word') as HTMLInputElement)?.checked || false;
              replaceAll(r, cs, ww);
            }}>Replace all</Button>
          </div>
        </div>
      )}

      {/* Versions panel */}
      {showVersions && !distractionFree && (
        <div className="absolute right-2 bottom-10 z-20 w-[28rem] max-w-full bg-white border rounded shadow p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">Versions</div>
            <Button size="sm" variant="outline" onClick={() => setShowVersions(false)}>Close</Button>
          </div>
          <div className="text-xs text-gray-600">Save current as version</div>
          <div className="flex gap-2">
            <input id="ver-label" className="border rounded px-2 py-1 text-sm flex-1" placeholder="Label (optional)" />
            <Button size="sm" variant="outline" onClick={async () => {
              try {
                const label = (document.getElementById('ver-label') as HTMLInputElement)?.value || '';
                if (!resumeId) return;
                const content = (editorRef.current?.querySelector('.ProseMirror') as HTMLElement | null)?.innerHTML || '';
                await fetch(`/api/resumes/${resumeId}/versions`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ label, content })
                });
                const list = await (await fetch(`/api/resumes/${resumeId}/versions`, { credentials: 'include' })).json();
                setVersions(list);
                toast.success('Version saved');
              } catch { toast.error('Failed to save version'); }
            }}>Save</Button>
          </div>
          <div className="max-h-64 overflow-auto space-y-1 mt-2">
            {versions.map((v, i) => (
              <div key={i} className="border rounded px-2 py-1 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{v.label || 'auto'} • {new Date(v.ts).toLocaleString()}</div>
                    <div className="text-gray-500">{v.fileName} • {v.contentLen} chars</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={async () => {
                      try {
                        const list = await (await fetch(`/api/resumes/${resumeId}/versions`, { credentials: 'include' })).json();
                        const item = list[i];
                        if (item && item.content) {
                          const prose = editorRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
                          if (prose) prose.innerHTML = item.content;
                          toast.success('Version restored');
                        } else {
                          toast.error('Content not available in list');
                        }
                      } catch { toast.error('Failed to restore version'); }
                    }}>Restore</Button>
                  </div>
                </div>
                {i < versions.length - 1 && versions[i + 1]?.content && v.content && (
                  <div className="mt-2 bg-gray-50 rounded p-2 overflow-auto max-h-32">
                    <div className="text-[10px] text-gray-700 mb-1">Diff vs previous</div>
                    <pre className="text-[10px] whitespace-pre-wrap break-words">{computeDiffSummary(versions[i + 1].content!, v.content!)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments panel (local-only UI) */}
      {showComments && !distractionFree && (
        <div className="absolute left-2 bottom-10 z-20 w-80 bg-white border rounded shadow p-3 space-y-2">
          <div className="text-xs font-semibold text-gray-700">Add inline comment</div>
          <textarea className="w-full border rounded px-2 py-1 text-sm" value={commentDraft} onChange={e => setCommentDraft(e.target.value)} placeholder="Type comment…" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              const sel = document.getSelection();
              if (!sel || !sel.rangeCount) { toast.info('Select text to comment'); return; }
              const mark = document.createElement('mark');
              mark.title = commentDraft || 'Comment';
              const range = sel.getRangeAt(0); range.surroundContents(mark);
              setCommentDraft('');
            }}>Comment selection</Button>
            <Button size="sm" variant="outline" onClick={() => {
              document.querySelectorAll('mark[title]')?.forEach(m => m.classList.toggle('hidden'));
            }}>Toggle highlights</Button>
          </div>
        </div>
      )}

      {/* Track changes panel (local-only visual) */}
      {showTrack && !distractionFree && (
        <div className="absolute left-2 bottom-40 z-20 w-80 bg-white border rounded shadow p-3 space-y-2">
          <div className="text-xs text-gray-700">Track changes (local visual only)</div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => document.execCommand('underline', false)}>Mark change</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const sel = document.getSelection();
              if (!sel || !sel.rangeCount) return;
              const span = document.createElement('span');
              span.style.background = '#fde68a';
              const range = sel.getRangeAt(0); range.surroundContents(span);
            }}>Highlight</Button>
            <Button size="sm" variant="outline" onClick={() => {
              document.querySelectorAll('span[style*="background"]')?.forEach(s => (s as HTMLElement).style.background = 'transparent');
            }}>Clear highlights</Button>
          </div>
        </div>
      )}

      {/* Table panel */}
      {showTable && !distractionFree && (
        <div className="absolute right-2 top-16 z-20 w-80 bg-white border rounded shadow p-3 space-y-2">
          <div className="text-xs font-semibold text-gray-700">Insert</div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => document.execCommand('insertHTML', false, '<table border=1 style=\'border-collapse:collapse;width:100%\'><tr><th>Header</th><th>Header</th></tr><tr><td>Cell</td><td>Cell</td></tr></table>')}>Table 2x2</Button>
          </div>
          <div className="text-xs font-semibold text-gray-700 mt-2">Row</div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => document.execCommand('insertHTML', false, '<tr><td>Cell</td><td>Cell</td></tr>')}>Add below</Button>
          </div>
          <div className="text-xs font-semibold text-gray-700 mt-2">Column</div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => document.execCommand('insertHTML', false, '<td>Cell</td>')}>Add right</Button>
          </div>
          <div className="text-xs font-semibold text-gray-700 mt-2">Header row</div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => {
              const sel = document.getSelection();
              const cell = sel?.anchorNode ? (sel.anchorNode as HTMLElement).closest('td,th') : null;
              const row = cell?.closest('tr');
              if (row) {
                const headers = Array.from(row.children) as HTMLElement[];
                headers.forEach(c => { c.outerHTML = `<th>${c.innerHTML}</th>`; });
              }
            }}>Make header</Button>
          </div>
          <div className="text-xs font-semibold text-gray-700 mt-2">Borders</div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => {
              const sel = document.getSelection();
              const table = sel?.anchorNode ? (sel.anchorNode as HTMLElement).closest('table') as HTMLElement | null : null;
              if (table) table.style.border = '1px solid #999';
            }}>Outer</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const sel = document.getSelection();
              const table = sel?.anchorNode ? (sel.anchorNode as HTMLElement).closest('table') as HTMLElement | null : null;
              if (table) Array.from(table.querySelectorAll('td,th')).forEach((c: any) => c.style.border = '1px solid #ccc');
            }}>Inner</Button>
          </div>
          <div className="text-xs font-semibold text-gray-700 mt-2">Shading</div>
          <div className="flex gap-2 flex-wrap">
          <div className="text-xs font-semibold text-gray-700 mt-2">Cell ops</div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => {
              const sel = document.getSelection();
              const cell = sel?.anchorNode ? (sel.anchorNode as HTMLElement).closest('td,th') as HTMLElement | null : null;
              const row = cell?.closest('tr') as HTMLElement | null;
              if (row && cell) {
                const clone = cell.cloneNode(true);
                cell.after(clone);
              }
            }}>Duplicate cell</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const sel = document.getSelection();
              const cell = sel?.anchorNode ? (sel.anchorNode as HTMLElement).closest('td,th') as HTMLElement | null : null;
              cell?.remove();
            }}>Delete cell</Button>
          </div>
            <Button size="sm" variant="outline" onClick={() => {
              const sel = document.getSelection();
              const cell = sel?.anchorNode ? (sel.anchorNode as HTMLElement).closest('td,th') as HTMLElement | null : null;
              if (cell) cell.style.background = '#f3f4f6';
            }}>Cell gray</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuperDocEditor;
