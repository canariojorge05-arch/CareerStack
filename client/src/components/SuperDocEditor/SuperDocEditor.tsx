import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Download, Save, AlertCircle, Loader2, ZoomIn, ZoomOut, Maximize2, Minimize2, List, Image as ImageIcon, Columns2, Type, ChevronDown, ChevronUp, Search } from 'lucide-react';
import html2canvas from 'html2canvas';

// Import SuperDoc styles
import '@harbour-enterprises/superdoc/super-editor/style.css';

interface SuperDocEditorProps {
  fileUrl: string;
  fileName?: string;
  onSave?: (content: any) => void;
  onExport?: (file: Blob) => void;
  className?: string;
  height?: string;
}

declare global {
  interface Window {
    SuperEditor: any;
  }
}

export function SuperDocEditor({
  fileUrl,
  fileName,
  onSave,
  onExport,
  className = '',
  height = '100vh'
}: SuperDocEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
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

  const pageSelector = '.pagination-inner';
  const proseSelector = '.ProseMirror';

  useEffect(() => {
    const initializeEditor = async () => {
      console.log('🔍 Checking initialization conditions...');
      console.log('editorRef.current:', editorRef.current);
      console.log('fileUrl:', fileUrl);
      
      if (!editorRef.current) {
        console.error('❌ editorRef.current is null/undefined');
        setError('Editor container not available');
        setIsLoading(false);
        return;
      }
      
      if (!fileUrl) {
        console.error('❌ fileUrl is missing');
        setError('Document URL not provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Import SuperDoc and inspect its structure
        const SuperDocModule = await import('@harbour-enterprises/superdoc') as any;
        console.log('=== SuperDoc Module Analysis ===');
        console.log('Full module:', SuperDocModule);
        console.log('Available exports:', Object.keys(SuperDocModule));
        console.log('Default export:', SuperDocModule.default);
        console.log('Editor export:', SuperDocModule.Editor);
        console.log('SuperEditor export:', SuperDocModule.SuperEditor);
        
        // If the high-level SuperDoc API is available, prefer it
        const SuperDocCtor = SuperDocModule.SuperDoc;
        const hasSuperDoc = typeof SuperDocCtor === 'function';
        
        // Fallback constructor (lower-level editor APIs)
        const EditorConstructor = (
          SuperDocModule.SuperEditor ||
          SuperDocModule.Editor ||
          SuperDocModule.default
        );
        if (!hasSuperDoc && typeof EditorConstructor !== 'function') {
          throw new Error('No valid SuperDoc constructor found. Available exports: ' + Object.keys(SuperDocModule).join(', '));
        }

        // Suppress SuperDoc module manager warnings in development
        if (import.meta.env.DEV) {
          const originalConsoleWarn = console.warn;
          console.warn = (...args) => {
            if (args[0]?.includes?.('module_manager') || args[0]?.includes?.('service worker')) {
              return; // Suppress SuperDoc service worker warnings in dev
            }
            originalConsoleWarn.apply(console, args);
          };
        }

        // Add unique ID to the editor container
        const editorId = `superdoc-editor-${Date.now()}`;
        if (editorRef.current) {
          editorRef.current.id = editorId;
        }

        console.log('Initializing SuperDoc with:', {
          selector: `#${editorId}`,
          fileSource: fileUrl,
          editorConstructor: typeof window.SuperEditor
        });

        // Based on console analysis, use the correct SuperDoc API
        console.log('🚀 Using correct SuperDoc API based on prototype methods...');
        
        // Try different approaches to get extensions (starter set first)
        let extensions: any[] = [];
        try {
          if (typeof SuperDocModule.getStarterExtensions === 'function') {
            extensions = SuperDocModule.getStarterExtensions();
            console.log('✅ Got extensions from getStarterExtensions');
          }
        } catch (e) {
          console.log('❌ getStarterExtensions failed:', (e as Error).message);
        }
        if (extensions.length === 0 && typeof SuperDocModule.getRichTextExtensions === 'function') {
          try {
            extensions = SuperDocModule.getRichTextExtensions();
            console.log('✅ Got extensions from getRichTextExtensions');
          } catch (e) {
            console.log('❌ getRichTextExtensions failed:', (e as Error).message);
          }
        }
        if (extensions.length === 0 && SuperDocModule.Extensions) {
          try {
            extensions = SuperDocModule.Extensions;
            console.log('✅ Got extensions from Extensions export');
          } catch (e) {
            console.log('❌ Extensions export failed:', (e as Error).message);
          }
        }
        
        // Helper: authenticated fetch for protected DOCX route
        const fetchDocBlob = async (): Promise<Blob> => {
          const response = await fetch(fileUrl, { credentials: 'include' });
          if (!response.ok) {
            throw new Error(`Failed to fetch document (${response.status} ${response.statusText})`);
          }
          return await response.blob();
        };

        // SuperDoc needs a document during initialization, not after mounting
        console.log('📄 Preparing to initialize SuperDoc with document:', fileUrl);
        
        let editorInstance: any;
        
        // Primary attempt: Use high-level SuperDoc API
        const initPatterns = [
          async () => {
            if (!hasSuperDoc) throw new Error('SuperDoc class not available');
            // Ensure container has an ID
            const editorId = editorRef.current!.id || `superdoc-editor-${Date.now()}`;
            editorRef.current!.id = editorId;
            const blob = await fetchDocBlob();
            const fileObj = typeof SuperDocModule.getFileObject === 'function'
              ? SuperDocModule.getFileObject(blob, fileName || 'document.docx')
              : blob;
            const instance = new SuperDocCtor({
              selector: `#${editorId}`,
              documentMode: 'docx',
              format: 'docx',
              pagination: true,
              rulers: true,
              documents: [
                { id: 'active-doc', type: 'docx', data: fileObj, name: fileName || 'document.docx' }
              ],
              toolbar: true,
              editable: true,
              collaboration: false
            });
            return instance;
          },
          // Initialize editor with extensions and file (lower-level API)
          async () => {
            const blob = await fetchDocBlob();
            const instance = new EditorConstructor({
              element: editorRef.current!,
              editable: true,
              toolbar: true,
              collaboration: false,
              extensions,
              pagination: true,
              file: blob
            });
            if (typeof instance.mount === 'function' && editorRef.current) {
              await instance.mount(editorRef.current);
            }
            return instance;
          },
          // Alternative: mount first then load/replace file
          async () => {
            const instance = new EditorConstructor({
              editable: true,
              toolbar: true,
              collaboration: false,
              extensions,
              pagination: true
            });
            if (typeof instance.mount === 'function' && editorRef.current) {
              await instance.mount(editorRef.current);
            } else if (editorRef.current) {
              // Some builds accept element at init only
              try { instance.element = editorRef.current; } catch {}
            }
            const blob = await fetchDocBlob();
            if (typeof instance.replaceFile === 'function') {
              await instance.replaceFile(blob);
            } else if (typeof instance.loadFile === 'function') {
              await instance.loadFile(blob);
            }
            return instance;
          },
          // Use BlankDOCX as a safe bootstrap (string data URL)
          async () => {
            if (!SuperDocModule.BlankDOCX) throw new Error('BlankDOCX not available');
            const response = await fetch(SuperDocModule.BlankDOCX);
            const blankBlob = await response.blob();
            const instance = new EditorConstructor({
              element: editorRef.current!,
              editable: true,
              toolbar: true,
              collaboration: false,
              extensions,
              file: blankBlob
            });
            const docBlob = await fetchDocBlob();
            if (typeof instance.replaceFile === 'function') {
              await instance.replaceFile(docBlob);
            } else if (typeof instance.loadFile === 'function') {
              await instance.loadFile(docBlob);
            }
            return instance;
          },
          // Simple document viewer fallback
          async () => {
            console.log('📄 Creating simple document viewer...');
            
            if (!editorRef.current) {
              throw new Error('No editor container available');
            }
            
            // Clear container
            editorRef.current.innerHTML = '';
            
            // Create a simple document viewer
            const viewerContainer = document.createElement('div');
            viewerContainer.style.width = '100%';
            viewerContainer.style.height = '100%';
            viewerContainer.style.padding = '20px';
            viewerContainer.style.backgroundColor = 'white';
            viewerContainer.style.border = '1px solid #ddd';
            viewerContainer.style.borderRadius = '8px';
            viewerContainer.style.fontFamily = 'Arial, sans-serif';
            
            // Add document info
            viewerContainer.innerHTML = `
              <div style="text-align: center; padding: 40px;">
                <h3 style="color: #333; margin-bottom: 20px;">Document Viewer</h3>
                <p style="color: #666; margin-bottom: 20px;">File: ${fileName || 'document.docx'}</p>
                <p style="color: #666; margin-bottom: 30px;">SuperDoc is loading...</p>
                <div style="margin: 20px 0;">
                  <button id="download-btn" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin: 0 10px;
                  ">Download DOCX</button>
                  <button id="view-btn" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin: 0 10px;
                  ">Open in New Tab</button>
                </div>
              </div>
            `;
            
            editorRef.current.appendChild(viewerContainer);
            
            // Add event listeners
            const downloadBtn = viewerContainer.querySelector('#download-btn');
            const viewBtn = viewerContainer.querySelector('#view-btn');
            
            if (downloadBtn) {
              downloadBtn.addEventListener('click', () => {
                const link = document.createElement('a');
                link.href = fileUrl;
                link.download = fileName || 'document.docx';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              });
            }
            
            if (viewBtn) {
              viewBtn.addEventListener('click', () => {
                // Try to open in new tab; many browsers will download DOCX instead
                const newTab = window.open(fileUrl, '_blank');
                if (!newTab) {
                  // Popup blocked or download occurred — provide explicit download as fallback
                  const link = document.createElement('a');
                  link.href = fileUrl;
                  link.download = fileName || 'document.docx';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }
              });
            }
            
            // Create mock editor object
            const mockEditor = {
              element: editorRef.current,
              save: () => console.log('Save not available in viewer mode'),
              export: () => {
                const link = document.createElement('a');
                link.href = fileUrl;
                link.download = fileName || 'document.docx';
                link.click();
              },
              destroy: () => {
                if (editorRef.current) {
                  editorRef.current.innerHTML = '';
                }
              }
            };
            
            setIsLoading(false);
            toast.success('Document viewer ready');
            return mockEditor;
          }
        ];
        
        let lastError: any;
        for (let i = 0; i < initPatterns.length; i++) {
          try {
            console.log(`🔄 Trying initialization pattern ${i + 1}...`);
            editorInstance = await initPatterns[i]();
            if (editorInstance) {
              console.log(`✅ Pattern ${i + 1} succeeded!`);
              break;
            }
          } catch (error) {
            lastError = error;
            console.log(`❌ Pattern ${i + 1} failed:`, (error as Error).message);
          }
        }
        
        if (!editorInstance) {
          throw new Error(`All SuperDoc initialization patterns failed. Last error: ${(lastError as Error).message}`);
        }
        
        console.log('✅ SuperDoc initialized successfully');

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
          });

          editorInstance.on('error', (err: any) => {
            setError(err.message || 'Failed to load document');
            setIsLoading(false);
            toast.error('Failed to load document');
          });

          editorInstance.on('save', (content: any) => {
            onSave?.(content);
            toast.success('Document saved');
          });

          editorInstance.on('export', (file: Blob) => {
            onExport?.(file);
          });
        } else {
          // Fallback: assume editor is ready immediately
          setIsLoading(false);
          toast.success('Document loaded successfully');
        }

        setEditor(editorInstance);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize editor';
        console.error('SuperDoc initialization error:', err);
        setError(errorMessage);
        setIsLoading(false);
        toast.error('Failed to initialize SuperDoc editor');
      }
    };

    initializeEditor();

    // Cleanup function
    return () => {
      if (editor) {
        try {
          // Try different cleanup methods
          if (editor.destroy) {
            editor.destroy();
          } else if (editor.unmount) {
            editor.unmount();
          } else if (editor.$destroy) {
            editor.$destroy();
          }
        } catch (err) {
          console.warn('Error destroying editor:', err);
        }
      }
      
      // Clear the container to prevent Vue mounting conflicts
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      window.removeEventListener('keydown', onKeyDownNav);
    };
  }, [fileUrl, onSave, onExport]);

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
    try {
      const pages = getPageEls();
      const limit = Math.min(pages.length, 30);
      const imgs: string[] = [];
      for (let i = 0; i < limit; i++) {
        const el = pages[i];
        const canvas = await html2canvas(el, { scale: 0.2, useCORS: true, backgroundColor: '#ffffff' });
        imgs.push(canvas.toDataURL('image/png'));
      }
      setThumbnails(imgs);
    } catch (e) {
      console.warn('Thumbnail generation failed', e);
    } finally {
      setIsGeneratingThumbs(false);
    }
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
    window.addEventListener('keydown', onKeyDownNav);
    return () => window.removeEventListener('keydown', onKeyDownNav);
  }, [currentPage]);

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

  const handleSave = () => {
    if (editor) {
      editor.save();
    }
  };

  const handleExport = () => {
    if (editor) {
      editor.export();
    }
  };


  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`} style={{ height }}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Document</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
          >
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  return (
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

          <Button onClick={handleSave} disabled={isLoading || !editor} variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" /> Save
          </Button>
          <Button onClick={handleExport} disabled={isLoading || !editor} size="sm">
            <Download className="h-4 w-4 mr-2" /> Export DOCX
          </Button>
        </div>
      </div>

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
          <div>{wordCount.toLocaleString()} words • {charCount.toLocaleString()} chars</div>
        </div>
      )}
    </div>
  );
}

export default SuperDocEditor;