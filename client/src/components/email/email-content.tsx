import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Mail } from 'lucide-react';
import './email-content.css';

interface EmailContentProps {
  htmlBody: string | null;
  textBody: string | null;
}

// Memoized EmailContent component to prevent unnecessary re-renders
// The CSS is now in a separate file to avoid DOM mutations
export const EmailContent = React.memo(({ htmlBody, textBody }: EmailContentProps) => {
  // Sanitize HTML only when htmlBody changes
  const sanitizedHtml = useMemo(() => {
    if (!htmlBody) return null;

    // Configure DOMPurify once
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
      // Apply hooks during sanitization
      WHOLE_DOCUMENT: false,
    });

    return clean;
  }, [htmlBody]);

  // Add target and rel attributes to all links after sanitization
  const processedHtml = useMemo(() => {
    if (!sanitizedHtml) return null;
    
    // Create a temporary div to manipulate the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sanitizedHtml;
    
    // Add security attributes to all links
    tempDiv.querySelectorAll('a').forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
    
    return tempDiv.innerHTML;
  }, [sanitizedHtml]);

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

  if (htmlBody && processedHtml) {
    return (
      <div className="email-content-wrapper mt-4 mb-4">
        <div
          dangerouslySetInnerHTML={{ __html: processedHtml }}
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
