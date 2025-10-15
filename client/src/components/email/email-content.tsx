import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Mail } from 'lucide-react';
import './email-content.css';

interface EmailContentProps {
  htmlBody: string | null;
  textBody: string | null;
}

// Memoized EmailContent component to prevent unnecessary re-renders
// Optimized: No DOM manipulation, uses DOMPurify hooks for link processing
export const EmailContent = React.memo(({ htmlBody, textBody }: EmailContentProps) => {
  // Sanitize and process HTML in a single pass using DOMPurify hooks
  const sanitizedHtml = useMemo(() => {
    if (!htmlBody) return null;

    // Configure DOMPurify with hooks to add attributes during sanitization
    // This avoids the need for post-processing with DOM manipulation
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      // Add target and rel to all links during sanitization
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });

    const clean = DOMPurify.sanitize(htmlBody, {
      ADD_TAGS: ['style', 'img', 'a', 'table', 'tbody', 'thead', 'tr', 'td', 'th'],
      ADD_ATTR: [
        'href', 'target', 'rel', 'style', 'class', 'src', 'alt', 
        'width', 'height', 'border', 'cellpadding', 'cellspacing', 
        'align', 'valign', 'bgcolor'
      ],
      ALLOW_DATA_ATTR: true,
      FORCE_BODY: true,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM: false,
      WHOLE_DOCUMENT: false,
    });

    // Remove hook to prevent it from affecting other sanitization calls
    DOMPurify.removeHook('afterSanitizeAttributes');

    return clean;
  }, [htmlBody]);

  if (!htmlBody && !textBody) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <div className="text-center">
          <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No content to display</p>
        </div>
      </div>
    );
  }

  if (htmlBody && sanitizedHtml) {
    return (
      <div className="email-content-wrapper mt-4 mb-4">
        <div
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          className="prose prose-sm max-w-none"
        />
      </div>
    );
  }

  // Fallback to text body
  return (
    <div className="email-content-wrapper mt-4 mb-4">
      <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">
        {textBody || 'No content available'}
      </p>
    </div>
  );
});

EmailContent.displayName = 'EmailContent';
