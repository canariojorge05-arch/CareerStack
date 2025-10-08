import DOMPurify from 'isomorphic-dompurify';

// Configure DOMPurify for CKEditor HTML output
DOMPurify.addHook('uponSanitizeElement', (node) => {
  if (node.nodeType === 1) { // Element node
    // Preserve CKEditor attributes that are safe
    const element = node as Element;
    const safeAttributes = [
      'class',
      'style',
      'data-alignment',
      'data-indent',
      'data-list-type',
      'data-list-style',
      'colspan',
      'rowspan'
    ];
    
    for (const attr of element.getAttributeNames()) {
      if (!safeAttributes.includes(attr)) {
        element.removeAttribute(attr);
      }
    }
  }
});

// Configure allowed tags and attributes for CKEditor
const editorConfig = {
  ALLOWED_TAGS: [
    // Block elements
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'div', 'blockquote', 'pre',
    
    // Inline elements
    'span', 'strong', 'em', 'u', 's', 'sub', 'sup',
    'code', 'br',
    
    // Lists
    'ul', 'ol', 'li',
    
    // Tables
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    
    // Links
    'a',
    
    // Images
    'img',
    
    // Semantic elements
    'article', 'section', 'aside', 'figure', 'figcaption'
  ],
  
  ALLOWED_ATTR: [
    // Global attributes
    'class', 'id', 'style',
    
    // Alignment and formatting
    'data-alignment', 'align', 'valign',
    'data-indent',
    
    // Lists
    'data-list-type', 'data-list-style', 'start', 'value',
    
    // Tables
    'colspan', 'rowspan', 'width', 'height',
    
    // Links
    'href', 'target', 'rel',
    
    // Images
    'src', 'alt', 'title'
  ],
  
  ALLOWED_STYLES: {
    '*': {
      // Text formatting
      'color': [/^#[0-9a-f]{3,6}$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
      'background-color': [/^#[0-9a-f]{3,6}$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
      'font-family': [/.*/],
      'font-size': [/^\d+(?:px|pt|em|rem)$/],
      'font-weight': [/^(?:normal|bold|[1-9]00)$/],
      'font-style': [/^(?:normal|italic)$/],
      'text-decoration': [/^(?:none|underline|line-through)$/],
      'text-align': [/^(?:left|center|right|justify)$/],
      
      // Spacing
      'margin': [/^[\d.]+(px|pt|em|rem)(?:\s+[\d.]+(px|pt|em|rem)){0,3}$/],
      'padding': [/^[\d.]+(px|pt|em|rem)(?:\s+[\d.]+(px|pt|em|rem)){0,3}$/],
      'line-height': [/^[\d.]+$|^[\d.]+(px|pt|em|rem)$/],
      
      // Lists
      'list-style-type': [/^(?:disc|circle|square|decimal|lower-alpha|upper-alpha|lower-roman|upper-roman)$/],
      
      // Tables
      'border': [/^[\d.]+(px|pt) solid #[0-9a-f]{3,6}$/i],
      'border-collapse': [/^(?:collapse|separate)$/],
      'width': [/^[\d.]+(?:px|pt|em|rem|%)$/],
      'height': [/^[\d.]+(?:px|pt|em|rem|%)$/],
      'vertical-align': [/^(?:top|middle|bottom)$/]
    }
  },
  
  FORBID_TAGS: [
    'script', 'style', 'iframe', 'form', 'input', 'textarea',
    'button', 'select', 'option', 'meta', 'link', 'title'
  ],
  
  FORBID_ATTR: [
    'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout',
    'onkeydown', 'onkeyup', 'onkeypress'
  ]
};

/**
 * Sanitizes HTML from CKEditor for safe storage and processing
 */
export function sanitizeEditorHtml(html: string): string {
  return DOMPurify.sanitize(html, editorConfig);
}

/**
 * Prepares HTML for DOCX export by adding necessary styling
 */
export function prepareHtmlForDocx(html: string): string {
  // Add CSS styles for DOCX export
  const exportStyles = `
    <style>
      @import url('ckeditor-docx-export.css');
    </style>
  `;
  
  return exportStyles + sanitizeEditorHtml(html);
}

/**
 * Prepares HTML from DOCX for loading into CKEditor
 */
export function prepareDocxHtmlForEditor(html: string): string {
  // Clean up any LibreOffice-specific markup
  let cleanHtml = html
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/<meta[\s\S]*?>/g, '') // Remove meta tags
    .replace(/<link[\s\S]*?>/g, ''); // Remove link tags
    
  // Sanitize the HTML
  return sanitizeEditorHtml(cleanHtml);
}