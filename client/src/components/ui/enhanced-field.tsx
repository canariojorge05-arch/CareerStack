import React, { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HelpCircle, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface EnhancedFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value?: string | null;
  label: string;
  tooltip?: string;
  mask?: string;
  copyable?: boolean;
  error?: string;
}

export const EnhancedField = React.forwardRef<HTMLInputElement, EnhancedFieldProps>(
  ({ label, tooltip, mask, copyable, error, value, onChange, ...props }, ref) => {
    const [isCopied, setIsCopied] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (mask) {
        let newValue = e.target.value;
        // Apply phone number mask (XXX) XXX-XXXX
        if (mask === 'phone') {
          newValue = newValue.replace(/\D/g, '');
          if (newValue.length > 0) {
            const matches = newValue.match(/(\d{0,3})(\d{0,3})(\d{0,4})/)!;
            newValue = !matches[2]
              ? matches[1]
              : `(${matches[1]}) ${matches[2]}${matches[3] ? `-${matches[3]}` : ''}`;
          }
        }
        e.target.value = newValue;
      }
      onChange?.(e);
    };

    const handleCopy = () => {
      if (inputRef.current) {
        navigator.clipboard.writeText(inputRef.current.value);
        setIsCopied(true);
        toast.success('Copied to clipboard');
        setTimeout(() => setIsCopied(false), 2000);
      }
    };

    return (
      <div className="relative space-y-1">
        <div className="flex items-center space-x-2">
          <Label htmlFor={props.id}>{label}</Label>
          {tooltip && (
            <div className="group relative">
              <HelpCircle className="h-4 w-4 text-gray-400" />
              <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform rounded bg-gray-800 p-2 text-xs text-white group-hover:block">
                {tooltip}
                <div className="absolute left-1/2 top-full -translate-x-1/2 transform border-4 border-transparent border-t-gray-800"></div>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <Input
            ref={inputRef}
            value={value || ''}
            onChange={handleChange}
            aria-describedby={error ? `${props.id}-error` : undefined}
            {...props}
          />
          {copyable && value && (
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-2 top-1/2 -translate-y-1/2 transform"
              aria-label="Copy to clipboard"
            >
              {isCopied ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-gray-400" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-500" id={`${props.id}-error`}>
            {error}
          </p>
        )}
      </div>
    );
  }
);

EnhancedField.displayName = 'EnhancedField';
