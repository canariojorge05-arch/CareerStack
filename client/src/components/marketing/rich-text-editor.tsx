import React from 'react';
import { Textarea } from '@/components/ui/textarea';

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
      <Textarea
        value={value}
        onChange={(e) => handleEditorChange(e.target.value)}
        placeholder={placeholder}
        disabled={readonly}
        className="w-full"
        style={{ minHeight: height }}
      />
    </div>
  );
}