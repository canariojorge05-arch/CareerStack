import React, { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
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
  // Construct file URL from resume data
  const fileUrl = resume.originalPath 
    ? `/api/resumes/${resume.id}/file`
    : null;

  const handleSuperDocSave = useCallback(async (content: any) => {
    // SuperDocEditor now handles the actual saving to server
    // Just notify parent that save completed
    await onSave();
  }, [onSave]);

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
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0" style={{ height: '100%', width: '100%', maxWidth: '100%' }}>
        <SuperDocEditor
          fileUrl={fileUrl}
          fileName={resume.fileName}
          resumeId={resume.id}
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