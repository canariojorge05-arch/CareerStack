import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { Save, Download, Loader2, AlertCircle } from 'lucide-react';
import SuperDocEditor from './SuperDocEditor';
import type { Resume } from '@shared/schema';

interface SuperDocResumeEditorProps {
  resume: Resume;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onExport?: (file: Blob) => void;
  className?: string;
}

export function SuperDocResumeEditor({
  resume,
  onContentChange,
  onSave,
  onExport,
  className = ''
}: SuperDocResumeEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Construct file URL from resume data
  const fileUrl = resume.originalPath 
    ? `/api/resumes/${resume.id}/file`
    : null;

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      await onSave();
      setHasChanges(false);
      setLastSaved(new Date());
      toast.success('Resume saved successfully');
    } catch (error) {
      toast.error('Failed to save resume');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, onSave]);

  const handleSuperDocSave = useCallback((content: any) => {
    // Convert SuperDoc content to string if needed
    const contentString = typeof content === 'string' ? content : JSON.stringify(content);
    onContentChange(contentString);
    setHasChanges(true);
  }, [onContentChange]);

  const handleSuperDocExport = useCallback((file: Blob) => {
    // Create download link
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resume.fileName || 'resume'}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Document exported successfully');
    onExport?.(file);
  }, [resume.fileName, onExport]);

  // Auto-save functionality
  useEffect(() => {
    if (hasChanges) {
      const autoSaveTimer = setTimeout(() => {
        handleSave();
      }, 5000); // Auto-save after 5 seconds of inactivity

      return () => clearTimeout(autoSaveTimer);
    }
  }, [hasChanges, handleSave]);

  if (!fileUrl) {
    return (
      <Card className={`h-full ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Document Not Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            The original DOCX file for this resume could not be found.
            Please re-upload the document.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`h-full flex flex-col ${className}`} style={{ height: '100vh', width: '100vw', maxWidth: '100%', overflow: 'hidden' }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold">
              {resume.fileName}
            </CardTitle>
            <Badge variant={resume.status === 'ready' ? 'default' : 'secondary'}>
              {resume.status}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="outline" className="text-orange-600">
                Unsaved changes
              </Badge>
            )}
            
            {lastSaved && (
              <span className="text-xs text-gray-500">
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
            
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              size="sm"
              variant="outline"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0" style={{ height: '100%', width: '100%', maxWidth: '100%' }}>
        <SuperDocEditor
          fileUrl={fileUrl}
          fileName={resume.fileName}
          onSave={handleSuperDocSave}
          onExport={handleSuperDocExport}
          className="h-full w-full"
          height="100vh"
        />
      </CardContent>
    </Card>
  );
}

export default SuperDocResumeEditor;