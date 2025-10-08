import React from 'react';
import { Button } from '../ui/button';
import { Download, AlertCircle, ExternalLink } from 'lucide-react';

interface FallbackEditorProps {
  fileUrl: string;
  fileName?: string;
  className?: string;
  height?: string;
}

export function FallbackEditor({
  fileUrl,
  fileName,
  className = '',
  height = '100vh'
}: FallbackEditorProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'document.docx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(fileUrl, '_blank');
  };

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            {fileName || 'Document Viewer'}
          </h2>
          <span className="text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded">
            Fallback Mode
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenInNewTab}
            variant="outline"
            size="sm"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in New Tab
          </Button>
          
          <Button
            onClick={handleDownload}
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Download DOCX
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ height: 'calc(100% - 80px)' }}>
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            SuperDoc Editor Unavailable
          </h3>
          <p className="text-gray-600 mb-6">
            The SuperDoc editor could not be initialized. You can still download the document 
            or open it in a new tab to view/edit it with your system's default application.
          </p>
          
          <div className="space-y-3">
            <Button onClick={handleDownload} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download Document
            </Button>
            
            <Button onClick={handleOpenInNewTab} variant="outline" className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Browser
            </Button>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>For Developers:</strong> Check the console for SuperDoc initialization errors. 
              The SuperDoc package may need different configuration or a different version.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FallbackEditor;
