import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Download, Save, AlertCircle, Loader2 } from 'lucide-react';

// Import SuperDoc styles
import '@harbour-enterprises/superdoc/dist/style.css';

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<any>(null);

  useEffect(() => {
    const initializeEditor = async () => {
      if (!editorRef.current || !fileUrl) return;

      try {
        setIsLoading(true);
        setError(null);

        // Check if Editor is available
        if (typeof window.SuperEditor === 'undefined') {
          // Try to load Editor dynamically
          const { Editor } = await import('@harbour-enterprises/superdoc');
          window.SuperEditor = Editor;
        }

        // Initialize the editor
        const editorInstance = new window.SuperEditor({
          selector: editorRef.current,
          fileSource: fileUrl,
          options: {
            user: {
              name: 'Editor User',
              email: 'editor@example.com',
            },
            theme: 'light',
            toolbar: {
              show: true,
              position: 'top',
            },
            collaboration: {
              enabled: false,
            },
            autoSave: {
              enabled: true,
              interval: 30000, // 30 seconds
            },
          },
        });

        // Set up event listeners
        editorInstance.on('ready', () => {
          setIsLoading(false);
          toast.success('Document loaded successfully');
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

        setEditor(editorInstance);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize editor';
        setError(errorMessage);
        setIsLoading(false);
        toast.error('Failed to initialize editor');
      }
    };

    initializeEditor();

    // Cleanup function
    return () => {
      if (editor) {
        try {
          editor.destroy();
        } catch (err) {
          console.warn('Error destroying editor:', err);
        }
      }
    };
  }, [fileUrl, onSave, onExport]);

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
            disabled={isLoading || !editor}
            variant="outline"
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          
          <Button
            onClick={handleExport}
            disabled={isLoading || !editor}
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