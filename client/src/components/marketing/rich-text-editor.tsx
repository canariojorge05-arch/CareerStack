import React from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  readonly?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Compose your email...",
  height = 400,
  readonly = false
}: RichTextEditorProps) {
  const handleEditorChange = (content: string) => {
    onChange(content);
  };

  return (
    <div className="rich-text-editor" style={{ minHeight: height }}>
      <CKEditor
        editor={ClassicEditor}
        data={value}
        onChange={(event, editor) => {
          const data = editor.getData();
          handleEditorChange(data);
        }}
        config={{
          toolbar: {
            items: [
              'heading', '|',
              'bold', 'italic', '|',
              'link', 'imageUpload', '|',
              'bulletedList', 'numberedList', '|',
              'outdent', 'indent', '|',
              'blockQuote', 'insertTable', '|',
              'undo', 'redo'
            ]
          },
          placeholder,
          image: {
            toolbar: ['imageTextAlternative', 'imageStyle:full', 'imageStyle:side']
          },
          table: {
            contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
          }
        }}
        disabled={readonly}
      />
    </div>
  );
}