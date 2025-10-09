import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Download, Save, AlertCircle, Loader2 } from 'lucide-react';

import '@harbour-enterprises/superdoc/style.css';

interface SuperDocEditorProps {
  fileUrl: string;
  fileName?: string;
  onSave?: (content: any) => void;
  onExport?: (file: Blob) => void;
  className?: string;
  height?: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [superdoc, setSuperdoc] = useState<any>(null);

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

        const { SuperDoc, getFileObject } = await import('@harbour-enterprises/superdoc');

        const editorId = `superdoc-${Date.now()}`;
        if (editorRef.current) {
          editorRef.current.id = editorId;
        }

        const response = await fetch(fileUrl, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const fileObject = getFileObject(blob, fileName || 'document.docx');

        const superdocInstance = new SuperDoc({
          selector: `#${editorId}`,
          documents: [
            {
              id: 'main-document',
              type: 'docx',
              data: fileObject,
            },
          ],
        });

        superdocInstance.on('ready', () => {
          console.log('SuperDoc ready');
          setIsLoading(false);
          toast.success('Document loaded successfully');
        });

        superdocInstance.on('error', (err: any) => {
          console.error('SuperDoc error:', err);
          setError(err?.message || 'Failed to load document');
          setIsLoading(false);
          toast.error('Failed to load document');
        });

        setSuperdoc(superdocInstance);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize editor';
        console.error('SuperDoc initialization error:', err);
        setError(errorMessage);
        setIsLoading(false);
        toast.error(errorMessage);
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
    };
  }, [fileUrl, fileName]);

  const handleSave = async () => {
    if (!superdoc) return;

    try {
      const content = superdoc.state;
      onSave?.(content);
      toast.success('Document saved');
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save document');
    }
  };

  const handleExport = async () => {
    if (!superdoc) return;

    try {
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
        toast.success('Document exported successfully');
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export document');
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
    <div className={`relative ${className}`} style={{ height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading document...</p>
          </div>
        </div>
      )}
      
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {fileName || 'Document Editor'}
          </h2>
          {isLoading && (
            <span className="text-sm text-gray-500">Loading...</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={isLoading || !superdoc}
            variant="outline"
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>

          <Button
            onClick={handleExport}
            disabled={isLoading || !superdoc}
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export DOCX
          </Button>
        </div>
      </div>

      {/* Editor Container */}
      <div 
        ref={editorRef} 
        className="flex-1"
        style={{ height: 'calc(100% - 80px)' }}
      />
    </div>
  );
}

export default SuperDocEditor;