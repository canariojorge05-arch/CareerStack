import React from 'react';
import { FileText, AlertCircle } from 'lucide-react';
import { SuperDocEditor } from './SuperDocEditor/SuperDocEditor';
import type { Resume as SharedResume, PointGroup as SharedPointGroup } from '@shared/schema';

interface AdvancedResumeEditorProps {
  resume: SharedResume;
  pointGroups: SharedPointGroup[];
  content: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onExport: () => void;
  isProcessing?: boolean;
  hasChanges?: boolean;
  lastSaved?: Date | null;
}

export default function AdvancedResumeEditor({
  resume,
  pointGroups,
  content,
  onContentChange,
  onSave,
  onExport,
  isProcessing = false,
  hasChanges = false,
  lastSaved,
}: AdvancedResumeEditorProps) {
  // Construct file URL for SuperDoc
  const fileUrl = resume.originalPath 
    ? `/api/resumes/${resume.id}/file`
    : null;

  const handleSuperDocSave = (savedContent: any) => {
    // SuperDoc handles saving internally, just notify parent
    onContentChange('Content saved via SuperDoc');
    onSave();
  };

  const handleSuperDocExport = (file: Blob) => {
    // Create download link for the exported file
    const url = window.URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = resume.fileName || 'document.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    onExport();
  };

  if (!fileUrl) {
    return (
      <div className="bg-white shadow-lg rounded-lg border border-gray-200">
        <div className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            File Not Found
          </h3>
          <p className="text-gray-600">
            The original DOCX file for this resume could not be located.
          </p>
          <p className="text-gray-600">
            Please ensure the file was uploaded correctly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-lg rounded-lg border border-gray-200">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {resume.fileName || 'Untitled Document'}
            </h3>
            {hasChanges && (
              <span className="text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {lastSaved && `Last saved: ${lastSaved.toLocaleTimeString()}`}
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <SuperDocEditor
          fileUrl={fileUrl}
          fileName={resume.fileName || 'document.docx'}
          resumeId={resume.id}
          onSave={handleSuperDocSave}
          onExport={handleSuperDocExport}
          height="600px"
          className="border rounded-lg"
        />
      </div>
    </div>
  );
}