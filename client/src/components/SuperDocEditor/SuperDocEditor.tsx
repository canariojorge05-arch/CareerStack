import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Download, Save, AlertCircle, Loader2, ZoomIn, ZoomOut, Maximize2, Minimize2, List, Image as ImageIcon, Columns2, Type, ChevronDown, ChevronUp, Search, Settings, FilePlus2, Table as TableIcon, MessageSquare, PenLine, BookMarked } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
// fallback to main-thread PDF if worker bundling fails

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
  };

  const handleExport = () => {
    if (editor) {
      editor.export();
    }
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