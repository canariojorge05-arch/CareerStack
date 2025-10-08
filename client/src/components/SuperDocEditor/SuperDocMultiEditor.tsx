import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '../ui/resizable';
import { toast } from 'sonner';
import { 
  X, 
  Save, 
  Download, 
  FileText, 
  Loader2, 
  Grid, 
  Maximize2, 
  Minimize2,
  ArrowLeft,
  Settings
} from 'lucide-react';
import SuperDocResumeEditor from './SuperDocResumeEditor';
import type { Resume } from '@shared/schema';

interface OpenResume {
  id: string;
  resume: Resume;
  content: string;
  pointGroups: any[];
  hasChanges: boolean;
  isProcessing: boolean;
  lastSaved: Date | null;
}

interface SuperDocMultiEditorProps {
  openResumes: { [key: string]: OpenResume };
  onContentChange: (resumeId: string, content: string) => void;
  onSaveResume: (resumeId: string) => void;
  onCloseResume: (resumeId: string) => void;
  onSaveAll: () => void;
  onBulkExport: (resumeIds: string[]) => void;
  onBackToSelector: () => void;
}

type ViewLayout = 'single' | 'split-2' | 'split-3' | 'split-4' | 'grid';

export default function SuperDocMultiEditor({
  openResumes,
  onContentChange,
  onSaveResume,
  onCloseResume,
  onSaveAll,
  onBulkExport,
  onBackToSelector
}: SuperDocMultiEditorProps) {
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [viewLayout, setViewLayout] = useState<ViewLayout>('single');
  const [isSaving, setIsSaving] = useState(false);

  const resumeList = useMemo(() => Object.values(openResumes), [openResumes]);
  const selectedResume = selectedResumeId ? openResumes[selectedResumeId] : null;

  // Auto-select first resume if none selected
  React.useEffect(() => {
    if (!selectedResumeId && resumeList.length > 0) {
      setSelectedResumeId(resumeList[0].id);
    }
  }, [selectedResumeId, resumeList]);

  const handleSaveResume = useCallback(async (resumeId: string) => {
    setIsSaving(true);
    try {
      await onSaveResume(resumeId);
      toast.success('Resume saved successfully');
    } catch (error) {
      toast.error('Failed to save resume');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onSaveResume]);

  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSaveAll();
      toast.success('All resumes saved successfully');
    } catch (error) {
      toast.error('Failed to save all resumes');
      console.error('Save all error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onSaveAll]);

  const handleBulkExport = useCallback(async (resumeIds: string[]) => {
    try {
      await onBulkExport(resumeIds);
      toast.success('Bulk export started');
    } catch (error) {
      toast.error('Failed to start bulk export');
      console.error('Bulk export error:', error);
    }
  }, [onBulkExport]);

  const handleContentChange = useCallback((resumeId: string, content: string) => {
    onContentChange(resumeId, content);
  }, [onContentChange]);

  const handleExport = useCallback((file: Blob, resumeId: string) => {
    // Create download link
    const url = URL.createObjectURL(file);
    const resume = openResumes[resumeId];
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resume?.resume.fileName || 'resume'}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Document exported successfully');
  }, [openResumes]);

  if (resumeList.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Resumes Selected</h3>
          <p className="text-gray-600 mb-4">Please go back and select resumes to edit.</p>
          <Button onClick={onBackToSelector} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Resume Selection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={onBackToSelector} variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-semibold text-gray-900">
              SuperDoc Multi-Editor
            </h1>
            <Badge variant="outline">
              {resumeList.length} resume{resumeList.length > 1 ? 's' : ''} open
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* View Layout Controls */}
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={viewLayout === 'single' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewLayout('single')}
                title="Single View"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                variant={viewLayout === 'split-2' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewLayout('split-2')}
                title="Split View"
              >
                <Grid className="h-4 w-4" />
              </Button>
            </div>

            {/* Save Controls */}
            <Button
              onClick={handleSaveAll}
              disabled={isSaving || !resumeList.some(r => r.hasChanges)}
              variant="outline"
              size="sm"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save All
            </Button>

            <Button
              onClick={() => handleBulkExport(resumeList.map(r => r.id))}
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Export All
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {viewLayout === 'single' ? (
          <div className="h-full flex">
            {/* Resume List Sidebar */}
            <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Open Resumes</h3>
                <div className="space-y-2">
                  {resumeList.map((openResume) => (
                    <Card
                      key={openResume.id}
                      className={`cursor-pointer transition-colors ${
                        selectedResumeId === openResume.id
                          ? 'ring-2 ring-blue-500 bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedResumeId(openResume.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {openResume.resume.fileName}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant={openResume.resume.status === 'ready' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {openResume.resume.status}
                              </Badge>
                              {openResume.hasChanges && (
                                <Badge variant="outline" className="text-xs text-orange-600">
                                  Unsaved
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloseResume(openResume.id);
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1">
              {selectedResume ? (
                <SuperDocResumeEditor
                  resume={selectedResume.resume}
                  onContentChange={(content) => handleContentChange(selectedResume.id, content)}
                  onSave={() => handleSaveResume(selectedResume.id)}
                  onExport={(file) => handleExport(file, selectedResume.id)}
                  className="h-full"
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Select a resume to start editing</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Split view implementation
          <div className="h-full">
            <ResizablePanelGroup direction="horizontal">
              {resumeList.slice(0, Math.min(resumeList.length, 2)).map((openResume, index) => (
                <React.Fragment key={openResume.id}>
                  <ResizablePanel defaultSize={50} minSize={30}>
                    <div className="h-full flex flex-col">
                      <div className="bg-white border-b border-gray-200 p-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {openResume.resume.status}
                          </Badge>
                          <span className="text-sm font-medium truncate">
                            {openResume.resume.fileName}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCloseResume(openResume.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex-1">
                        <SuperDocResumeEditor
                          resume={openResume.resume}
                          onContentChange={(content) => handleContentChange(openResume.id, content)}
                          onSave={() => handleSaveResume(openResume.id)}
                          onExport={(file) => handleExport(file, openResume.id)}
                          className="h-full"
                        />
                      </div>
                    </div>
                  </ResizablePanel>
                  {index < Math.min(resumeList.length, 2) - 1 && (
                    <ResizableHandle />
                  )}
                </React.Fragment>
              ))}
            </ResizablePanelGroup>
          </div>
        )}
      </div>
    </div>
  );
}