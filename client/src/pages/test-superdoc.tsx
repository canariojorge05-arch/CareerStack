import React from 'react';
import { SuperDocEditor } from '@/components/SuperDocEditor';

export default function TestSuperDocPage() {
  // Test with a sample DOCX file URL
  const testResumeId = 'test'; // This would be a real resume ID
  const testFileUrl = `/api/resumes/${testResumeId}/file`;

  return (
    <div className="h-screen flex flex-col">
      <div className="p-4 bg-gray-100 border-b">
        <h1 className="text-xl font-bold">SuperDoc Test Page</h1>
        <p>Testing SuperDoc editor integration</p>
      </div>
      <div className="flex-1">
        <SuperDocEditor
          fileUrl={testFileUrl}
          fileName="test-document.docx"
          resumeId={testResumeId}
          onSave={(content) => console.log('Save:', content)}
          onExport={(file) => console.log('Export:', file)}
          height="100%"
        />
      </div>
    </div>
  );
}