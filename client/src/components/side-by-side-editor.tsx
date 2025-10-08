import { useState, useCallback, useMemo, useRef, Suspense, lazy, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  X,
  Save,
  Download,
  FileText,
  Loader2,
  Grid,
  Maximize2,
  Minimize2,
  Eye,
  Copy,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Resume, PointGroup } from '@shared/schema';

// Lazy load heavy components
const AdvancedResumeEditor = lazy(() => import('./advanced-resume-editor'));

interface OpenResume {
  id: string;
  resume: Resume;
  content: string;
  pointGroups: PointGroup[];
  hasChanges: boolean;
  isProcessing: boolean;
  lastSaved: Date | null;
}

interface SideBySideEditorProps {
  openResumes: { [key: string]: OpenResume };
  onContentChange: (resumeId: string, content: string) => void;
  onSaveResume: (resumeId: string) => void;
  onCloseResume: (resumeId: string) => void;
  onSaveAll: () => void;
  onBulkExport: (resumeIds: string[]) => void;
  onBackToSelector: () => void; // New prop for back navigation
}

type ViewLayout = 'single' | 'split-2' | 'split-3' | 'split-4' | 'grid';

// Enhanced resource pooling for super-high performance
class EditorResourcePool {
  private editorInstances = new Map<string, any>();
  private componentPool = new Map<string, any>();
  private recycledComponents: any[] = [];
  private readonly MAX_POOL_SIZE = 8;
  private readonly MAX_RECYCLED = 5;
  private lastCleanup = Date.now();
  private readonly CLEANUP_INTERVAL = 30000; // 30 seconds

  getOrCreateEditor(id: string, resume: any) {
    // Auto-cleanup old instances
    this.autoCleanup();
    
    if (this.editorInstances.has(id)) {
      const instance = this.editorInstances.get(id);
      instance.lastAccessed = Date.now();
      return instance;
    }

    // Try to recycle a component first
    let editorComponent = this.recycledComponents.pop();
    if (!editorComponent) {
      editorComponent = {
        id: Date.now().toString(),
        created: Date.now(),
        renderCount: 0
      };
    }

    const instance = {
      ...editorComponent,
      resumeId: id,
      lastAccessed: Date.now(),
      resume,
      renderCount: (editorComponent.renderCount || 0) + 1
    };

    this.editorInstances.set(id, instance);
    
    // Evict oldest if pool is full
    if (this.editorInstances.size > this.MAX_POOL_SIZE) {
      this.evictOldest();
    }

    return instance;
  }

  recycleEditor(id: string) {
    const instance = this.editorInstances.get(id);
    if (instance && this.recycledComponents.length < this.MAX_RECYCLED) {
      // Clean the instance for reuse
      const recycled = {
        id: instance.id,
        created: instance.created,
        renderCount: instance.renderCount,
        recycled: Date.now()
      };
      this.recycledComponents.push(recycled);
    }
    this.editorInstances.delete(id);
  }

  private evictOldest() {
    let oldestId: string | null = null;
    let oldestTime = Date.now();
    
    for (const [id, instance] of this.editorInstances) {
      if (instance.lastAccessed < oldestTime) {
        oldestTime = instance.lastAccessed;
        oldestId = id;
      }
    }
    
    if (oldestId) {
      this.recycleEditor(oldestId);
    }
  }

  private autoCleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL) return;
    
    // Clean up instances not accessed in the last 5 minutes
    const cutoff = now - 300000;
    for (const [id, instance] of this.editorInstances) {
      if (instance.lastAccessed < cutoff) {
        this.recycleEditor(id);
      }
    }
    
    // Clean recycled components older than 10 minutes
    this.recycledComponents = this.recycledComponents.filter(
      component => (now - component.recycled) < 600000
    );
    
    this.lastCleanup = now;
  }

  getStats() {
    return {
      activeInstances: this.editorInstances.size,
      recycledComponents: this.recycledComponents.length,
      totalRenders: Array.from(this.editorInstances.values())
        .reduce((sum, instance) => sum + instance.renderCount, 0)
    };
  }
}

const resourcePool = new EditorResourcePool();

// Memoized resume editor component for better performance
const MemoizedResumeEditor = memo(({ 
  resumeId, 
  openResume, 
  onContentChange, 
  onSaveResume, 
  onBulkExport 
}: {
  resumeId: string;
  openResume: OpenResume;
  onContentChange: (resumeId: string, content: string) => void;
  onSaveResume: (resumeId: string) => void;
  onBulkExport: (resumeIds: string[]) => void;
}) => {
  const handleContentChange = useCallback(
    (content: string) => onContentChange(resumeId, content),
    [resumeId, onContentChange]
  );
  
  const handleSave = useCallback(
    () => onSaveResume(resumeId),
    [resumeId, onSaveResume]
  );
  
  const handleShowSaveOptions = useCallback(
    () => onBulkExport([resumeId]),
    [resumeId, onBulkExport]
  );

  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-center">
            <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Loading editor...</p>
          </div>
        </div>
      }
    >
      <AdvancedResumeEditor
        resume={openResume.resume}
        pointGroups={openResume.pointGroups}
        content={openResume.content}
        onContentChange={handleContentChange}
        onSave={handleSave}
        onShowSaveOptions={handleShowSaveOptions}
      />
    </Suspense>
  );
});

MemoizedResumeEditor.displayName = 'MemoizedResumeEditor';

export default function SideBySideEditor({
  openResumes,
  onContentChange,
  onSaveResume,
  onCloseResume,
  onSaveAll,
  onBulkExport,
  onBackToSelector,
}: SideBySideEditorProps) {
  const [viewLayout, setViewLayout] = useState<ViewLayout>('split-2');
  const [fullscreenResume, setFullscreenResume] = useState<string | null>(null);
  const [syncScrolling, setSyncScrolling] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  
  // Performance optimizations
  const scrollRef = useRef<HTMLDivElement>(null);

  // Memoized derived state for better performance
  const resumeIds = useMemo(() => Object.keys(openResumes), [openResumes]);
  const resumeCount = resumeIds.length;
  const hasUnsavedChanges = useMemo(
    () => Object.values(openResumes).some((r) => r.hasChanges),
    [openResumes]
  );
  
  // Memoized resume entries for stable references
  const resumeEntries = useMemo(
    () => Object.entries(openResumes),
    [openResumes]
  );

  // Auto-adjust layout based on number of open resumes
  const getOptimalLayout = useCallback((count: number): ViewLayout => {
    if (count <= 1) return 'single';
    if (count === 2) return 'split-2';
    if (count === 3) return 'split-3';
    return 'grid';
  }, []);

  // Copy content from one resume to another
  const copyContent = useCallback(
    (fromResumeId: string, toResumeId: string) => {
      const sourceResume = openResumes[fromResumeId];
      if (sourceResume) {
        onContentChange(toResumeId, sourceResume.content);
        toast.success(`Copied content from ${sourceResume.resume.fileName}`);
      }
    },
    [openResumes, onContentChange]
  );

  // Optimized memoized target list for copy functionality
  const copyTargets = useMemo(() => 
    resumeIds.reduce((acc, id) => {
      acc[id] = resumeIds
        .filter(targetId => targetId !== id)
        .map(targetId => ({
          id: targetId,
          fileName: openResumes[targetId]?.resume.fileName || 'Unknown'
        }));
      return acc;
    }, {} as Record<string, Array<{id: string, fileName: string}>>),
    [resumeIds, openResumes]
  );

  // Highly optimized render function with resource pooling
  const renderResumeEditor = useCallback((resumeId: string, isFullscreen = false) => {
    const openResume = openResumes[resumeId];
    if (!openResume) return null;

    // Get or create editor instance from enhanced resource pool
    const editorInstance = resourcePool.getOrCreateEditor(resumeId, openResume.resume);

    // Memoized handlers for this specific resume
    const handleSave = () => onSaveResume(resumeId);
    const handleClose = () => {
      resourcePool.recycleEditor(resumeId);
      onCloseResume(resumeId);
    };
    const handleFullscreen = () => setFullscreenResume(isFullscreen ? null : resumeId);
    const handleExport = () => onBulkExport([resumeId]);

    const targets = copyTargets[resumeId] || [];

    return (
      <div 
        key={`${resumeId}-${editorInstance.renderCount}`}
        className={`relative h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}
      >
        {/* Optimized Resume Header */}
        <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {!isFullscreen && (
              <Button variant="ghost" size="sm" onClick={onBackToSelector} className="mr-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Selector
              </Button>
            )}
            <FileText className="text-blue-600" size={18} />
            <div>
              <h3 className="font-medium text-sm">{openResume.resume.fileName}</h3>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {openResume.resume.status}
                </Badge>
                {openResume.hasChanges && (
                  <Badge variant="destructive" className="text-xs">
                    Unsaved
                  </Badge>
                )}
                {openResume.isProcessing && (
                  <Badge variant="secondary" className="text-xs">
                    <Loader2 size={10} className="animate-spin mr-1" />
                    Processing
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {/* Optimized Copy dropdown with memoized targets */}
            {targets.length > 0 && (
              <div className="relative group">
                <Button variant="ghost" size="sm" title="Copy to...">
                  <Copy size={14} />
                </Button>
                <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <div className="text-xs text-gray-500 mb-2">Copy content to:</div>
                  {targets.map(({ id: targetId, fileName }) => (
                    <Button
                      key={targetId}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => copyContent(resumeId, targetId)}
                    >
                      {fileName}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={!openResume.hasChanges}
              title="Save"
            >
              <Save size={14} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              title="Export"
            >
              <Download size={14} />
            </Button>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClose} 
              title="Close"
            >
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Memoized Resume Editor with Suspense */}
        <div className="h-full">
          <MemoizedResumeEditor
            resumeId={resumeId}
            openResume={openResume}
            onContentChange={onContentChange}
            onSaveResume={onSaveResume}
            onBulkExport={onBulkExport}
          />
        </div>
      </div>
    );
  }, [openResumes, copyTargets, onBackToSelector, onSaveResume, onBulkExport, onCloseResume, onContentChange, copyContent]);

  // Render layout controls
  const renderLayoutControls = () => (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-1 border rounded-lg p-1">
        {[
          { layout: 'single', icon: '1', title: 'Single' },
          { layout: 'split-2', icon: '2', title: 'Split (2)' },
          { layout: 'split-3', icon: '3', title: 'Split (3)' },
          { layout: 'grid', icon: '⊞', title: 'Grid' },
        ].map(({ layout, icon, title }) => (
          <Button
            key={layout}
            variant={viewLayout === layout ? 'default' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0 text-xs"
            onClick={() => setViewLayout(layout as ViewLayout)}
            title={title}
            disabled={layout === 'split-3' && resumeCount < 3}
          >
            {icon}
          </Button>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setViewLayout(getOptimalLayout(resumeCount))}
        title="Auto layout"
      >
        <Grid size={14} />
      </Button>
    </div>
  );

  if (resumeCount === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-500">
          <FileText size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">No resumes open</h3>
          <p>Select resumes to start editing simultaneously</p>
        </div>
      </div>
    );
  }

  // Fullscreen mode
  if (fullscreenResume && openResumes[fullscreenResume]) {
    return renderResumeEditor(fullscreenResume, true);
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top Controls */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold">Multi-Resume Editor</h2>
            <Badge variant="outline">{resumeCount} open</Badge>
            {hasUnsavedChanges && (
              <Badge variant="destructive" className="animate-pulse">
                Unsaved changes
              </Badge>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {renderLayoutControls()}

            <div className="flex items-center space-x-2 border-l pl-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSyncScrolling(!syncScrolling)}
                title="Sync scrolling"
              >
                <Eye size={14} className={syncScrolling ? 'text-blue-600' : ''} />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCompareMode(!compareMode)}
                title="Compare mode"
              >
                <Settings size={14} className={compareMode ? 'text-blue-600' : ''} />
              </Button>
            </div>

            <div className="flex items-center space-x-2 border-l pl-3">
              <Button onClick={onSaveAll} disabled={!hasUnsavedChanges}>
                <Save size={16} className="mr-2" />
                Save All
              </Button>

              <Button variant="outline" onClick={() => onBulkExport(resumeIds)}>
                <Download size={16} className="mr-2" />
                Export All
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Layout */}
      <div className="flex-1 overflow-hidden">
        {viewLayout === 'single' && (
          <div className="h-full">{renderResumeEditor(resumeIds[0])}</div>
        )}

        {viewLayout === 'split-2' && resumeCount >= 2 && (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50}>{renderResumeEditor(resumeIds[0])}</ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50}>{renderResumeEditor(resumeIds[1])}</ResizablePanel>
          </ResizablePanelGroup>
        )}

        {viewLayout === 'split-3' && resumeCount >= 3 && (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={33}>{renderResumeEditor(resumeIds[0])}</ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={33}>{renderResumeEditor(resumeIds[1])}</ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={34}>{renderResumeEditor(resumeIds[2])}</ResizablePanel>
          </ResizablePanelGroup>
        )}

        {viewLayout === 'grid' && (
          <div className="h-full p-4 overflow-auto">
            <div
              className={`grid gap-4 h-full ${
                resumeCount === 2
                  ? 'grid-cols-2'
                  : resumeCount === 3
                  ? 'grid-cols-2 grid-rows-2'
                  : 'grid-cols-2 grid-rows-2'
              }`}
            >
              {resumeIds.map((resumeId) => (
                <Card key={resumeId} className="overflow-hidden">
                  <div className="h-full">{renderResumeEditor(resumeId)}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Handle cases with fewer resumes than layout requires */}
        {viewLayout === 'split-2' && resumeCount === 1 && (
          <div className="h-full">{renderResumeEditor(resumeIds[0])}</div>
        )}
      </div>
    </div>
  );
}
