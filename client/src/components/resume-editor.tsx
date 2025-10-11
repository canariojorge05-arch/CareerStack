import { useState, useEffect, useRef, useCallback } from 'react';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  AlertCircle,
  Info,
  Lightbulb,
  BarChart3,
  Target,
  Sparkles,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { SuperDocEditor } from './SuperDocEditor/SuperDocEditor';
import type { Resume, PointGroup } from '@shared/schema';

interface ResumeEditorProps {
  resume: Resume;
  pointGroups: PointGroup[];
  onSave: (content: string) => void;
  onExport: () => void;
  isProcessing?: boolean;
}

export default function ResumeEditor({
  resume,
  pointGroups,
  onSave,
  onExport,
  isProcessing = false,
}: ResumeEditorProps) {
  const [activeTab, setActiveTab] = useState('editor');
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Construct file URL for SuperDoc
  const fileUrl = resume.originalPath 
    ? `/api/resumes/${resume.id}/file`
    : null;

  const handleSuperDocSave = (savedContent: any) => {
    // SuperDoc handles saving internally
    setHasChanges(false);
    setLastSaved(new Date());
    onSave('Content saved via SuperDoc');
    toast.success('Document saved successfully');
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
    toast.success('Document exported successfully');
  };

  const handleContentChange = (content: any) => {
    setHasChanges(true);
  };

  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          File Not Found
        </h3>
        <p className="text-gray-600">
          The original DOCX file for this resume could not be located.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {resume.fileName || 'Untitled Document'}
              </h2>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="outline">{resume.status}</Badge>
                {hasChanges && (
                  <Badge variant="secondary" className="text-orange-600">
                    Unsaved Changes
                  </Badge>
                )}
                {lastSaved && (
                  <span className="text-sm text-gray-500">
                    Last saved: {lastSaved.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {isProcessing && (
            <div className="flex items-center space-x-2">
              <LoadingSpinner size="sm" />
              <span className="text-sm text-blue-600">Processing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="editor" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Editor</span>
            </TabsTrigger>
            <TabsTrigger value="points" className="flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Tech Points ({pointGroups.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="flex-1 p-0">
            <div className="h-full">
              <SuperDocEditor
                fileUrl={fileUrl}
                fileName={resume.fileName || 'document.docx'}
                resumeId={resume.id}
                onSave={handleSuperDocSave}
                onExport={handleSuperDocExport}
                height="100%"
                className="border-0 rounded-none"
              />
            </div>
          </TabsContent>

          <TabsContent value="points" className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Tech Stack Points</h3>
                <Badge variant="outline">{pointGroups.length} groups</Badge>
              </div>
              
              {pointGroups.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No tech stack points available. Upload a DOCX file and configure tech stack to see points here.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-4">
                  {pointGroups.map((group, index) => {
                    const points = Array.isArray(group.points) ? group.points : [];
                    return (
                    <div key={index} className="bg-white p-4 rounded-lg border">
                      <div className="flex items-center space-x-2 mb-3">
                        <Sparkles className="h-5 w-5 text-blue-600" />
                        <h4 className="font-medium text-gray-900">{group.name}</h4>
                        <Badge variant="secondary">{points.length} points</Badge>
                      </div>
                      <div className="space-y-2">
                        {points.map((point: any, pointIndex: number) => (
                          <div key={pointIndex} className="flex items-start space-x-2">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                            <p className="text-sm text-gray-700">{point.description || point.text || String(point)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}